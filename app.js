
let githubConfig = {
    username: localStorage.getItem('gh_user') || '',
    repo: localStorage.getItem('gh_repo') || '',
    token: localStorage.getItem('gh_token') || ''
};

let repositoryFiles = [];

// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const dropdownMenu = document.getElementById('dropdownMenu');
const uploadModal = document.getElementById('uploadModal');
const deleteModal = document.getElementById('deleteModal');
const settingsModal = document.getElementById('settingsModal');

// Open/Close Dropdown Menu
menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('active');
});

document.addEventListener('click', () => {
    dropdownMenu.classList.remove('active');
});

// Modal Toggles
document.getElementById('btnOpenUpload').addEventListener('click', () => {
    checkConfigAndOpen(uploadModal);
});

document.getElementById('btnOpenDelete').addEventListener('click', () => {
    populateDeleteDropdown();
    checkConfigAndOpen(deleteModal);
});

document.getElementById('btnOpenSettings').addEventListener('click', () => {
    document.getElementById('cfgUser').value = githubConfig.username;
    document.getElementById('cfgRepo').value = githubConfig.repo;
    document.getElementById('cfgToken').value = githubConfig.token;
    openModal(settingsModal);
});

document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        closeAllModals();
    });
});

function openModal(modal) {
    closeAllModals();
    modal.classList.add('active');
}

function closeAllModals() {
    uploadModal.classList.remove('active');
    deleteModal.classList.remove('active');
    settingsModal.classList.remove('active');
}

function checkConfigAndOpen(modal) {
    if (!githubConfig.username || !githubConfig.repo || !githubConfig.token) {
        alert('আগে আপনার GitHub Username, Repo এবং Personal Access Token সেটআপ করুন!');
        openModal(settingsModal);
    } else {
        openModal(modal);
    }
}

// Save Settings Form
document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    githubConfig.username = document.getElementById('cfgUser').value.trim();
    githubConfig.repo = document.getElementById('cfgRepo').value.trim();
    githubConfig.token = document.getElementById('cfgToken').value.trim();

    localStorage.setItem('gh_user', githubConfig.username);
    localStorage.setItem('gh_repo', githubConfig.repo);
    localStorage.setItem('gh_token', githubConfig.token);

    alert('GitHub কনফিগারেশন সেভ হয়েছে!');
    closeAllModals();
    fetchRepositoryFiles();
});

// Fetch Repository Content via GitHub REST API
async function fetchRepositoryFiles() {
    if (!githubConfig.username || !githubConfig.repo) {
        renderFileList([]);
        return;
    }

    const fileListBody = document.getElementById('fileListBody');
    fileListBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem;">ফাইল লোড হচ্ছে...</td></tr>';

    try {
        const headers = githubConfig.token ? { 'Authorization': `token ${githubConfig.token}` } : {};
        const response = await fetch(`https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents`, { headers });

        if (!response.ok) throw new Error('Repository load failed');

        const data = await response.json();
        // Filter out directories and keep only files
        repositoryFiles = data.filter(item => item.type === 'file');
        renderFileList(repositoryFiles);
    } catch (err) {
        console.error(err);
        document.getElementById('fileListBody').innerHTML = '';
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('fileCount').textContent = '0';
    }
}

// Render File Table Layout
function renderFileList(files) {
    const fileListBody = document.getElementById('fileListBody');
    const emptyState = document.getElementById('emptyState');
    const fileCount = document.getElementById('fileCount');

    fileListBody.innerHTML = '';
    fileCount.textContent = files.length;

    if (files.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    files.forEach(file => {
        const tr = document.createElement('tr');
        
        // File icon based on extension
        let iconClass = 'fa-file-lines';
        if (file.name.match(/\.(jpg|jpeg|png|gif|svg)$/i)) iconClass = 'fa-file-image';
        else if (file.name.match(/\.(zip|rar|7z)$/i)) iconClass = 'fa-file-zipper';
        else if (file.name.match(/\.(html|css|js|json|php)$/i)) iconClass = 'fa-file-code';

        tr.innerHTML = `
            <td>
                <div class="file-name-cell">
                    <i class="fa-solid ${iconClass} file-icon"></i>
                    <span>${file.name}</span>
                </div>
            </td>
            <td style="color: var(--text-secondary); font-size: 0.9rem;">
                ${(file.size / 1024).toFixed(1)} KB
            </td>
            <td style="text-align: right;">
                <a href="${file.download_url}" class="btn-download" download target="_blank">
                    <i class="fa-solid fa-download"></i> ডাউনলোড
                </a>
                <button class="btn-delete-item" onclick="deleteFileDirect('${file.name}', '${file.sha}')" title="ডিলেট করুন">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        fileListBody.appendChild(tr);
    });
}

// Upload File Processing
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const commitMsg = document.getElementById('commitMsg').value;
    const submitBtn = document.getElementById('uploadSubmitBtn');

    if (!fileInput.files.length) return;

    const file = fileInput.files[0];
    submitBtn.textContent = 'আপলোড হচ্ছে...';
    submitBtn.disabled = true;

    try {
        const base64Content = await convertBase64(file);
        
        // Check if file already exists to pass SHA
        const existingFile = repositoryFiles.find(f => f.name === file.name);
        const payload = {
            message: commitMsg,
            content: base64Content
        };
        if (existingFile) {
            payload.sha = existingFile.sha;
        }

        const response = await fetch(`https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${file.name}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('ফাইল সফলভাবে GitHub-এ আপলোড হয়েছে!');
            closeAllModals();
            fileInput.value = '';
            fetchRepositoryFiles();
        } else {
            const errData = await response.json();
            alert('আপলোড ব্যর্থ হয়েছে: ' + (errData.message || 'অজানা সমস্যা'));
        }
    } catch (err) {
        alert('ত্রুটি: ' + err.message);
    } finally {
        submitBtn.textContent = 'আপলোড নিশ্চিত করুন';
        submitBtn.disabled = false;
    }
});

// Helper: Convert File to Base64 String
function convertBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
}

// Populate Delete Modal Dropdown
function populateDeleteDropdown() {
    const select = document.getElementById('deleteFileSelect');
    select.innerHTML = '<option value="">-- সিলেক্ট ফাইল --</option>';

    repositoryFiles.forEach(file => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ name: file.name, sha: file.sha });
        opt.textContent = file.name;
        select.appendChild(opt);
    });
}

// Delete File Processing from Modal
document.getElementById('deleteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectVal = document.getElementById('deleteFileSelect').value;
    if (!selectVal) return;

    const { name, sha } = JSON.parse(selectVal);
    await executeDelete(name, sha);
});

// Delete Direct Function
async function deleteFileDirect(filename, sha) {
    if (confirm(`আপনি কি সত্যি "${filename}" ফাইলটি GitHub থেকে মুছে ফেলতে চান?`)) {
        await executeDelete(filename, sha);
    }
}

// Execute Delete Request via GitHub API
async function executeDelete(filename, sha) {
    try {
        const response = await fetch(`https://api.github.com/repos/${githubConfig.username}/${githubConfig.repo}/contents/${filename}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Delete ${filename} via web interface`,
                sha: sha
            })
        });

        if (response.ok) {
            alert('ফাইলটি মুছে ফেলা হয়েছে!');
            closeAllModals();
            fetchRepositoryFiles();
        } else {
            const errData = await response.json();
            alert('ডিলেট করতে সমস্যা হয়েছে: ' + (errData.message || 'অজানা সমস্যা'));
        }
    } catch (err) {
        alert('ত্রুটি: ' + err.message);
    }
}

// Refresh Button Action
document.getElementById('btnRefresh').addEventListener('click', fetchRepositoryFiles);

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    if (githubConfig.username && githubConfig.repo) {
        fetchRepositoryFiles();
    }
});

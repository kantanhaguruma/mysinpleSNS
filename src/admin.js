import { addBan, removeBan, subscribeBans } from "./database.js";

// 管理者のホワイトリスト (ここに名前がある人だけが管理画面に入れる)
const ADMIN_WHITELIST = ['kantanhaguruma']; 

const loginScreen = document.getElementById('login-screen');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const scratchUsernameInput = document.getElementById('scratch-username');
const issueCodeBtn = document.getElementById('issue-code-btn');
const verificationCodeDisplay = document.getElementById('verification-code');
const verifyBtn = document.getElementById('verify-btn');
const loading = document.getElementById('loading');

const banUsernameInput = document.getElementById('ban-username');
const addBanBtn = document.getElementById('add-ban-btn');
const banListContainer = document.getElementById('ban-list-container');

let currentAdmin = JSON.parse(sessionStorage.getItem('admin_session')) || null;
let currentCode = "";

// 認証チェック
if (currentAdmin && ADMIN_WHITELIST.includes(currentAdmin)) {
    loginScreen.classList.add('hidden');
    startAdminSession();
}

issueCodeBtn.onclick = () => {
    const user = scratchUsernameInput.value.trim();
    if (!ADMIN_WHITELIST.includes(user)) return alert("あなたはこのページのアクセス権限がありません。");
    
    currentCode = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodeDisplay.textContent = currentCode;
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
};

const PROXIES = [
    "https://trampoline.turbowarp.org/proxy/scratch/", // Scratch専用・超安定
    "https://corsproxy.io/?",
    "https://api.allorigins.win/raw?url=",
    "https://api.codetabs.com/v1/proxy?quest="
];

async function fetchWithProxy(targetUrl, isJson = true) {
    let lastError = null;
    for (const proxy of PROXIES) {
        try {
            const isTurbowarp = proxy.includes("turbowarp.org");
            let url;
            if (isTurbowarp) {
                const path = targetUrl.replace("https://api.scratch.mit.edu/", "").replace("https://scratch.mit.edu/", "site/");
                url = `${proxy}${path}`;
            } else {
                url = `${proxy}${encodeURIComponent(targetUrl)}`;
            }

            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return isJson ? await res.json() : await res.text();
        } catch (e) {
            console.warn(`Proxy ${proxy} failed:`, e);
            lastError = e;
            continue;
        }
    }
    throw new Error(`接続エラー: ${lastError?.message}`);
}

verifyBtn.onclick = async () => {
    const user = scratchUsernameInput.value.trim();
    loading.classList.remove('hidden');
    
    try {
        const html = await fetchWithProxy(`https://scratch.mit.edu/site-api/comments/user/${user}/?page=1&t=${Date.now()}`, false);
        
        if (html.includes(currentCode)) {
            sessionStorage.setItem('admin_session', JSON.stringify(user));
            loginScreen.classList.add('hidden');
            startAdminSession();
        } else {
            alert("コードが見つかりませんでした。");
        }
    } catch (e) {
        alert("エラーが発生しました: " + e.message);
    } finally {
        loading.classList.add('hidden');
    }
};

function startAdminSession() {
    subscribeBans((bans) => {
        banListContainer.innerHTML = "";
        bans.forEach(ban => {
            const div = document.createElement('div');
            div.className = "ban-item";
            div.innerHTML = `
                <span>${ban.username} (BAN日時: ${ban.bannedAt?.toDate().toLocaleString() || '不明'})</span>
                <button onclick="window.confirmRemoveBan('${ban.username}')" class="!bg-red-100 !text-red-600 !border-red-200">解除</button>
            `;
            banListContainer.appendChild(div);
        });
    });
}

addBanBtn.onclick = async () => {
    const user = banUsernameInput.value.trim();
    if (!user) return;
    if (confirm(`${user} をBANしますか？`)) {
        await addBan(user);
        banUsernameInput.value = "";
    }
};

window.confirmRemoveBan = async (user) => {
    if (confirm(`${user} のBANを解除しますか？`)) {
        await removeBan(user);
    }
};

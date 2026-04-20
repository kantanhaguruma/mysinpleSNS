import { createThread, addReply, subscribeThreads, subscribeReplies, checkIsBanned } from "./database.js";

// DOM Elements - Login
const loginScreen = document.getElementById('login-screen');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const scratchUsernameInput = document.getElementById('scratch-username');
const issueCodeBtn = document.getElementById('issue-code-btn');
const verificationCodeDisplay = document.getElementById('verification-code');
const verifyBtn = document.getElementById('verify-btn');
const loadingSpinner = document.getElementById('loading-spinner');
const backToStep1 = document.getElementById('back-to-step1');
const profileLink = document.getElementById('profile-link');

// DOM Elements - App
const threadListView = document.getElementById('thread-list-view');
const threadDetailView = document.getElementById('thread-detail-view');
const threadListContainer = document.getElementById('thread-list-container');
const repliesContainer = document.getElementById('replies-container');
const currentThreadTitle = document.getElementById('current-thread-title');

// Forms
const newThreadTitle = document.getElementById('new-thread-title');
const newThreadBody = document.getElementById('new-thread-body');
const createThreadBtn = document.getElementById('create-thread-btn');
const replyName = document.getElementById('reply-name');
const replyBody = document.getElementById('reply-body');
const submitReplyBtn = document.getElementById('submit-reply-btn');
const backToList = document.getElementById('back-to-list');

const ADMIN_USERS = ['kantanhaguruma']; // ここに管理者のScratchユーザー名を追加

let currentUser = JSON.parse(sessionStorage.getItem('scratch_user')) || null;
let activeThreadId = null;
let unsubscribeReplies = null;
let currentVerificationCode = "";

// 1. 起動時の認証チェック
if (currentUser) {
    loginScreen.classList.add('hidden');
    replyName.value = currentUser.displayName;
    startThreadsSubscription();
} else {
    loginScreen.classList.remove('hidden');
}

// 管理者かどうかチェック
function isAdmin() {
    return currentUser && ADMIN_USERS.includes(currentUser.displayName);
}

// 2. Scratch認証ロジック
issueCodeBtn.onclick = () => {
    const username = scratchUsernameInput.value.trim();
    if (!username) return alert("ユーザー名を入力してください");
    
    currentVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    verificationCodeDisplay.textContent = currentVerificationCode;
    profileLink.href = `https://scratch.mit.edu/users/${username}/`;
    
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
};

backToStep1.onclick = () => {
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
};

// 通信プロキシのリスト
const PROXIES = [
    "https://trampoline.turbowarp.org/proxy/", // Scratch専用・超安定
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
                // Turbowarpプロキシの振り分け
                if (targetUrl.includes("api.scratch.mit.edu")) {
                    url = `${proxy}scratch/${targetUrl.replace("https://api.scratch.mit.edu/", "")}`;
                } else {
                    url = `${proxy}site/${targetUrl.replace("https://scratch.mit.edu/", "")}`;
                }
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
    const username = scratchUsernameInput.value.trim();
    
    try {
        loadingSpinner.classList.remove('hidden');
        verifyBtn.disabled = true;

        // 1. フォロワー数チェック
        const userData = await fetchWithProxy(`https://api.scratch.mit.edu/users/${username}/followers?limit=40`);
        if (!Array.isArray(userData)) throw new Error("Scratchユーザー情報が正しく取得できませんでした。");

        if (userData.length < 40) {
            throw new Error(`フォロワーが足りません（現在: ${userData.length}人 / 必要: 40人以上）`);
        }

        // 2. コメント欄の認証コードチェック
        const commentsHtml = await fetchWithProxy(`https://scratch.mit.edu/site-api/comments/user/${username}/?page=1&t=${Date.now()}`, false);

        if (!commentsHtml.includes(currentVerificationCode)) {
            throw new Error(`認証コード(${currentVerificationCode})が見つかりませんでした。投稿から反映まで30秒ほどかかる場合があります。`);
        }

        // 認証成功
        currentUser = {
            uid: `scratch_${username}`,
            displayName: username
        };
        sessionStorage.setItem('scratch_user', JSON.stringify(currentUser));
        
        loginScreen.classList.add('hidden');
        replyName.value = username;
        startThreadsSubscription();
        alert("認証に成功しました！");

    } catch (e) {
        alert("認証エラー: " + e.message);
    } finally {
        loadingSpinner.classList.add('hidden');
        verifyBtn.disabled = false;
    }
};

// 3. スレッド一覧の制御
function startThreadsSubscription() {
    subscribeThreads((threads) => {
        threadListContainer.innerHTML = "";
        threads.forEach(thread => {
            const date = thread.lastPostAt?.toDate ? thread.lastPostAt.toDate().toLocaleString() : "";
            const div = document.createElement('div');
            div.className = "thread-list-item";
            div.innerHTML = `
                <div class="font-bold">${thread.title} (${thread.replyCount})</div>
                <div class="text-xs text-gray-500">最終更新: ${date}</div>
            `;
            div.onclick = () => openThread(thread);
            threadListContainer.appendChild(div);
        });
    });
}

createThreadBtn.addEventListener('click', async () => {
    const title = newThreadTitle.value.trim();
    const body = newThreadBody.value.trim();
    if (!title || !body) return alert("タイトルと内容を入力してください");

    try {
        createThreadBtn.disabled = true;
        // BANチェック
        if (await checkIsBanned(currentUser.displayName)) {
            alert("あなたはBANされているため、投稿できません。");
            createThreadBtn.disabled = false;
            return;
        }
        await createThread(title, body, currentUser);
        newThreadTitle.value = "";
        newThreadBody.value = "";
        createThreadBtn.disabled = false;
    } catch (e) {
        alert("スレッド作成に失敗しました");
        createThreadBtn.disabled = false;
    }
});

// 4. スレッド詳細の制御
function openThread(thread) {
    activeThreadId = thread.id;
    currentThreadTitle.innerHTML = thread.title + (isAdmin() ? ` <span class="text-xs text-blue-600 cursor-pointer hover:underline ml-2" onclick="handleEditThreadTitle('${thread.id}', '${escapeHTML(thread.title)}')">[編集]</span>` : "");
    threadListView.classList.add('hidden');
    threadDetailView.classList.remove('hidden');

    if (unsubscribeReplies) unsubscribeReplies();
    unsubscribeReplies = subscribeReplies(thread.id, (replies) => {
        repliesContainer.innerHTML = "";
        replies.forEach(reply => {
            const date = reply.createdAt?.toDate ? reply.createdAt.toDate().toLocaleString() : "";
            
            const { formattedText, imageUrls } = parseText(reply.text);
            const imageHtml = imageUrls.map(url => `
                <div class="mt-2">
                    <img src="${url}" class="max-w-full md:max-w-xs max-h-80 rounded border border-gray-200 shadow-sm cursor-pointer hover:opacity-90" 
                         onclick="window.open('${url}')" 
                         onerror="this.style.display='none'">
                </div>
            `).join("");

            // 管理者の場合のみ削除・編集ボタンを表示
            const adminControls = isAdmin() ? `
                <span class="ml-2 text-red-600 cursor-pointer text-xs hover:underline" 
                      onclick="handleDeleteReply('${reply.id}')">[削除]</span>
                <span class="ml-1 text-blue-600 cursor-pointer text-xs hover:underline" 
                      onclick="handleEditReply('${reply.id}', '${reply.text.replace(/'/g, "\\'")}')">[編集]</span>
            ` : "";

            const div = document.createElement('div');
            div.className = "post";
            div.innerHTML = `
                <div class="post-header">
                    ${reply.number} : <span class="post-name">${escapeHTML(reply.name)}</span> : ${date} ID:${reply.idCode} ${adminControls}
                </div>
                <div class="post-body">${formattedText}${imageHtml}</div>
            `;
            repliesContainer.appendChild(div);
        });
        window.scrollTo(0, document.body.scrollHeight);
    });
}

// 削除処理の実行
window.handleDeleteReply = async (replyId) => {
    if (!confirm("この投稿を削除しますか？")) return;
    try {
        const { deleteReply } = await import("./database.js");
        await deleteReply(activeThreadId, replyId);
    } catch (e) {
        alert("削除に失敗しました: " + e.message);
    }
};

// レス編集処理の実行
window.handleEditReply = async (replyId, currentText) => {
    const newText = prompt("内容を編集してください:", currentText);
    if (newText === null || newText === currentText) return;
    try {
        const { updateReply } = await import("./database.js");
        await updateReply(activeThreadId, replyId, newText);
    } catch (e) {
        alert("編集に失敗しました: " + e.message);
    }
};

// スレッドタイトル編集処理の実行
window.handleEditThreadTitle = async (threadId, currentTitle) => {
    const newTitle = prompt("スレッドタイトルを編集してください:", currentTitle);
    if (!newTitle || newTitle === currentTitle) return;
    try {
        const { updateThreadTitle } = await import("./database.js");
        await updateThreadTitle(threadId, newTitle);
        currentThreadTitle.firstChild.textContent = newTitle + " "; // UIを即時更新
    } catch (e) {
        alert("タイトルの編集に失敗しました: " + e.message);
    }
};

function parseText(text) {
    const escaped = escapeHTML(text);
    const imageRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp))/gi;
    const imageUrls = text.match(imageRegex) || [];
    const linkedText = escaped.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" target="_blank" class="text-blue-600 underline">$1</a>');
    return { formattedText: linkedText, imageUrls: [...new Set(imageUrls)] };
}

backToList.onclick = () => {
    activeThreadId = null;
    threadListView.classList.remove('hidden');
    threadDetailView.classList.add('hidden');
    if (unsubscribeReplies) unsubscribeReplies();
};

submitReplyBtn.addEventListener('click', async () => {
    const text = replyBody.value.trim();
    const name = replyName.value.trim();
    if (!text || !activeThreadId) return;

    try {
        submitReplyBtn.disabled = true;
        // BANチェック
        if (await checkIsBanned(currentUser.displayName)) {
            alert("あなたはBANされているため、投稿できません。");
            submitReplyBtn.disabled = false;
            return;
        }
        await addReply(activeThreadId, text, name, currentUser);
        replyBody.value = "";
        submitReplyBtn.disabled = false;
    } catch (e) {
        alert("書き込みに失敗しました");
        submitReplyBtn.disabled = false;
    }
});

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

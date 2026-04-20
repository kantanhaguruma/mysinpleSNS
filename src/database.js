import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  limit,
  deleteDoc,
  getDocs,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * 新しいスレッドを作成
 */
export const createThread = async (title, firstPost, user) => {
  const threadRef = await addDoc(collection(db, "threads"), {
    title,
    createdAt: serverTimestamp(),
    lastPostAt: serverTimestamp(),
    replyCount: 0
  });
  await addReply(threadRef.id, firstPost, user.displayName, user);
};

/**
 * レスを投稿
 */
export const addReply = async (threadId, text, name, user) => {
  const threadRef = doc(db, "threads", threadId);
  await addDoc(collection(db, `threads/${threadId}/replies`), {
    text,
    name: name || "名無しさん",
    uid: user?.uid || "anonymous",
    idCode: user?.uid ? btoa(user.uid).slice(0, 8) : "????",
    createdAt: serverTimestamp()
  });

  await updateDoc(threadRef, {
    lastPostAt: serverTimestamp(),
    replyCount: increment(1)
  });
};

/**
 * スレッド一覧を購読
 */
export const subscribeThreads = (callback) => {
  const q = query(collection(db, "threads"), orderBy("lastPostAt", "desc"), limit(50));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

/**
 * 特定スレッドのレスを購読
 */
export const subscribeReplies = (threadId, callback) => {
  const q = query(collection(db, `threads/${threadId}/replies`), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc, index) => ({
      id: doc.id,
      number: index + 1,
      ...doc.data()
    })));
  });
};

/**
 * レスを削除 (管理者用)
 */
export const deleteReply = async (threadId, replyId) => {
  const threadRef = doc(db, "threads", threadId);
  const replyRef = doc(db, `threads/${threadId}/replies`, replyId);
  
  await deleteDoc(replyRef);
  
  // レス数をマイナス1
  await updateDoc(threadRef, {
    replyCount: increment(-1)
  });
};

/**
 * レスを更新 (管理者用)
 */
export const updateReply = async (threadId, replyId, newText) => {
  const replyRef = doc(db, `threads/${threadId}/replies`, replyId);
  await updateDoc(replyRef, {
    text: newText
  });
};

/**
 * スレッドタイトルを更新 (管理者用)
 */
export const updateThreadTitle = async (threadId, newTitle) => {
  const threadRef = doc(db, "threads", threadId);
  await updateDoc(threadRef, {
    title: newTitle
  });
};

/**
 * BANリストを購読
 */
export const subscribeBans = (callback) => {
  return onSnapshot(collection(db, "bans"), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

/**
 * ユーザーをBAN
 */
export const addBan = async (username) => {
  const banRef = doc(db, "bans", username);
  await updateDoc(banRef, {
    username,
    bannedAt: serverTimestamp()
  }).catch(async () => {
    // 存在しない場合は作成 (setDocと同じ挙動)
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await setDoc(banRef, {
      username,
      bannedAt: serverTimestamp()
    });
  });
};

/**
 * BAN解除
 */
export const removeBan = async (username) => {
  await deleteDoc(doc(db, "bans", username));
};

/**
 * BANされているかチェック
 */
export const checkIsBanned = async (username) => {
  const banRef = doc(db, "bans", username);
  const snap = await getDoc(banRef);
  return snap.exists();
};

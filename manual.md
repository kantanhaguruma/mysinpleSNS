# Firebase SNS アプリ設定・公開マニュアル

このSNSアプリを動作させるためには、Firebaseプロジェクトの設定が必要です。以下の手順に従って設定を行ってください。

## 1. Firebaseプロジェクトの作成
1. [Firebase Console](https://console.firebase.google.com/) にアクセスします。
2. 「プロジェクトを追加」をクリックし、任意のプロジェクト名（例: `simple-sns`）を入力します。
3. Google アナリティクスは任意（OFFでも可）で進め、プロジェクトを作成します。

## 2. アプリの登録と設定情報の取得
1. プロジェクトの概要ページで、ウェブアイコン（`</>`）をクリックしてウェブアプリを登録します。
2. アプリのニックネームを入力し「アプリを登録」をクリックします。
3. 表示された `firebaseConfig` オブジェクトの内容をコピーします。
4. プロジェクト内の `src/firebase-config.js` を開き、内容を貼り付けます。

### 3. 各機能の有効化

| 機能 | ステータス | 理由・設定 |
| :--- | :--- | :--- |
| **Authentication** | **必須** | Googleログインに使用します。Googleを有効にしてください。 |
| **Firestore Database**| **必須** | 投稿データの保存に使用します。「テストモード」で開始してください。 |
| **Storage** | **不要** | 画像投稿機能はコスト削減のため除外しました。 |

#### Firestoreセキュリティルールの設定
Firestoreの「ルール」タブに以下のコードを貼り付けて「公開」してください。
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // スレッドの読み書き
    match /threads/{threadId} {
      allow read: if true;
      allow write: if request.auth != null;
      
      // レス（返信）の読み書き
      match /replies/{replyId} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
  }
}
```


## 4. ローカルでの実行方法
このプロジェクトは Node.js 不要で動作します。以下のいずれかの方法で静的サーバーを起動してください。

**Python をお持ちの場合:**
```bash
python -m http.server 8000
```
その後、ブラウザで `http://localhost:8000` にアクセスしてください。

## 5. 公開（デプロイ）方法
Firebase Hosting を使用して無料で公開できます。

1. [Firebase CLI](https://firebase.google.com/docs/cli) をインストール（`npm install -g firebase-tools`）。
2. `firebase login` でログイン。
3. `firebase init hosting` で初期設定（`public` ディレクトリを `.` に指定）。
4. `firebase deploy` で公開完了！

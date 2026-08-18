// =========================================================================
// INISIALISASI USER DATA & AUDIO
// =========================================================================
let username = localStorage.getItem('chat_username');
let userToken = localStorage.getItem('chat_user_token');

const notifAudio = new Audio('notify.mp3');

// Elements DOM
const chatBox = document.getElementById('chatBox');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const replyToInput = document.getElementById('replyToId');

// Lock/Unlock Audio Context
function unlockAudio() {
    notifAudio.play().then(() => {
        notifAudio.pause();
        notifAudio.currentTime = 0;
        console.log("Audio berhasil di-unlock.");
    }).catch(err => console.log("Gagal unlock audio:", err));
}

function playNotificationSound() {
    notifAudio.currentTime = 0;
    notifAudio.play().catch(err => console.log("Gagal memutar audio:", err));
}

function initUserToken() {
    if (!userToken) {
        userToken = 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('chat_user_token', userToken);
    }
}

// =========================================================================
// MODAL & USER MANAGEMENT
// =========================================================================
function toggleModalBtn() {
    const checkbox = document.getElementById('tosAgree');
    const btn = document.getElementById('modalBtn');
    if (checkbox && btn) {
        btn.disabled = !checkbox.checked;
    }
}

function checkUserModal() {
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDesc');
    const input = document.getElementById('modalInputName');
    const btn = document.getElementById('modalBtn');

    if (!title || !desc || !input || !btn) return;

    if (username && username.trim() !== '') {
        title.innerText = "Selamat Datang Kembali!";
        desc.innerHTML = `Anda masuk sebagai <strong>${escapeHtmlText(username)}</strong>`;
        input.style.display = 'none';
        btn.innerText = "Setujui & Lanjutkan Ke Chat";
    } else {
        title.innerText = "Masukkan Nama";
        desc.innerText = "Silakan isi nama Anda untuk mulai mengobrol.";
        input.style.display = 'block';
        btn.innerText = "Setujui & Mulai Chat";
    }
}

function confirmWelcome() {
    const input = document.getElementById('modalInputName');
    const checkbox = document.getElementById('tosAgree');

    if (checkbox && !checkbox.checked) {
        alert("Anda wajib menyetujui Syarat & Ketentuan untuk melanjutkan.");
        return;
    }

    if (!username || username.trim() === '') {
        const enteredName = input ? input.value.trim() : '';
        if (!enteredName) {
            alert("Nama tidak boleh kosong!");
            return;
        }
        username = enteredName;
        localStorage.setItem('chat_username', username);
    }

    const displayNameEl = document.getElementById('displayName');
    if (displayNameEl) displayNameEl.innerText = username;

    unlockAudio();

    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) welcomeModal.style.display = 'none';

    // Mulai inisialisasi Chat & Realtime Listener
    initChat();
}

function changeUsername() {
    const newName = prompt('Masukkan nama baru Anda:', username || '');
    if (newName && newName.trim() !== '') {
        username = newName.trim();
        localStorage.setItem('chat_username', username);
        const displayNameEl = document.getElementById('displayName');
        if (displayNameEl) displayNameEl.innerText = username;
    }
}

// =========================================================================
// SUPABASE REALTIME & FETCH MESSAGES
// =========================================================================
let messagesCache = new Map();

async function initChat() {
    if (!username || typeof ROOM_CODE === 'undefined') return;

    // 1. Fetch pesan lama saat pertama kali masuk
    await loadInitialMessages();

    // 2. Setup Realtime Listener
    supabaseClient
        .channel(`room:${ROOM_CODE}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_code=eq.${ROOM_CODE}`
            },
            (payload) => handleIncomingMessage(payload.new)
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'messages',
                filter: `room_code=eq.${ROOM_CODE}`
            },
            (payload) => handleDeletedMessage(payload.old.id)
        )
        .subscribe();
}

async function loadInitialMessages() {
    const { data, error } = await supabaseClient
        .from('messages')
        .select(`
            id,
            room_code,
            sender_name,
            sender_token,
            message,
            reply_to_id,
            created_at
        `)
        .eq('room_code', ROOM_CODE)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Gagal memuat pesan:", error);
        return;
    }

    chatBox.innerHTML = '';
    
    // Simpan pesan ke cache lokal untuk kebutuhan relasi reply
    data.forEach(msg => messagesCache.set(msg.id, msg));
    
    data.forEach(msg => renderSingleMessage(msg));
    chatBox.scrollTop = chatBox.scrollHeight;
}

function handleIncomingMessage(msg) {
    messagesCache.set(msg.id, msg);
    renderSingleMessage(msg);

    const isMine = msg.sender_token === userToken;
    if (!isMine) {
        playNotificationSound();
        if (document.hidden) {
            document.title = "💬 Pesan Baru!";
        }
    }
}

function handleDeletedMessage(msgId) {
    messagesCache.delete(msgId);
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.remove();
}

function renderSingleMessage(msg) {
    if (!chatBox) return;

    const isMine = msg.sender_token === userToken;
    const createdDate = new Date(msg.created_at);
    const timeFormatted = createdDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    let replyHtml = '';
    if (msg.reply_to_id && messagesCache.has(msg.reply_to_id)) {
        const parentMsg = messagesCache.get(msg.reply_to_id);
        replyHtml = `
            <div class="reply-box">
                <strong>${escapeHtmlText(parentMsg.sender_name)}:</strong> ${escapeHtmlText(parentMsg.message)}
            </div>
        `;
    }

    let deleteBtnHtml = '';
    if (isMine || (username && username.toLowerCase() === 'admin')) {
        deleteBtnHtml = `<a onclick="deleteMessage(${msg.id})">Hapus</a>`;
    }

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMine ? 'mine' : ''}`;
    bubble.id = `msg-${msg.id}`;

    bubble.innerHTML = `
        <div class="chat-header">
            <span class="chat-sender">${escapeHtmlText(msg.sender_name)}</span>
            <span class="chat-time">${timeFormatted}</span>
        </div>
        ${replyHtml}
        <div class="chat-text">${escapeHtmlText(msg.message)}</div>
        <div class="chat-actions">
            <a onclick="setReply(${msg.id}, '${escapeQuote(msg.sender_name)}', '${escapeQuote(msg.message)}')">Balas</a>
            ${deleteBtnHtml}
        </div>
    `;

    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// =========================================================================
// SEND & DELETE ACTIONS
// =========================================================================
if (chatForm) {
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text || !username) return;

        const replyId = replyToInput ? replyToInput.value : null;

        const payload = {
            room_code: ROOM_CODE,
            sender_name: username,
            sender_token: userToken,
            message: text,
            reply_to_id: replyId ? parseInt(replyId) : null
        };

        messageInput.value = '';
        cancelReply();

        const { error } = await supabaseClient
            .from('messages')
            .insert([payload]);

        if (error) {
            alert('Gagal mengirim pesan: ' + error.message);
        }
    });
}

async function deleteMessage(id) {
    if (!confirm('Apakah kamu yakin ingin menghapus pesan ini?')) return;

    const { error } = await supabaseClient
        .from('messages')
        .delete()
        .eq('id', id);

    if (error) {
        alert('Gagal menghapus pesan: ' + error.message);
    }
}

// =========================================================================
// HELPER & UI UTILITIES
// =========================================================================
function setReply(id, sender, text) {
    if (replyToInput) replyToInput.value = id;
    const senderEl = document.getElementById('replySender');
    const textEl = document.getElementById('replyText');
    const previewEl = document.getElementById('replyPreview');

    if (senderEl) senderEl.innerText = sender;
    if (textEl) textEl.innerText = text;
    if (previewEl) previewEl.style.display = 'flex';
    if (messageInput) messageInput.focus();
}

function cancelReply() {
    if (replyToInput) replyToInput.value = '';
    const previewEl = document.getElementById('replyPreview');
    if (previewEl) previewEl.style.display = 'none';
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof ROOM_CODE !== 'undefined') {
        document.title = `Room Chat - ${ROOM_CODE}`;
    }
});

function escapeQuote(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function escapeHtmlText(str) {
    const div = document.createElement('div');
    div.innerText = str;
    return div.innerHTML;
}

// Global Register
window.toggleModalBtn = toggleModalBtn;
window.confirmWelcome = confirmWelcome;
window.changeUsername = changeUsername;
window.setReply = setReply;
window.cancelReply = cancelReply;
window.deleteMessage = deleteMessage;

// Init Token & Check User
initUserToken();
checkUserModal();
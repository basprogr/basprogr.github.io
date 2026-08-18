// Check Session Login (Ganti Auth PHP Session dengan Supabase Auth Session)
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
    }
}
checkAuth();

// Logout Handler
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});

// Utility Functions
function showAlert(message) {
    const alertBox = document.getElementById('alertBox');
    alertBox.innerText = message;
    alertBox.style.display = 'block';
    setTimeout(() => alertBox.style.display = 'none', 4000);
}

function generateRandomCode(length = 10) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Generate Link Room Baru
document.getElementById('generateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const expiredAt = document.getElementById('expired_at').value;
    const roomCode = generateRandomCode(10);

    const { data: { user } } = await supabaseClient.auth.getUser();

    const { data, error } = await supabaseClient
        .from('rooms')
        .insert([
            { 
                room_code: roomCode, 
                expired_at: new Date(expiredAt).toISOString(),
                created_by: user.id
            }
        ])
        .select();

    if (error) {
        alert('Gagal membuat room: ' + error.message);
        return;
    }

    const roomUrl = `${window.location.origin}/msg.html?room=${roomCode}`;
    document.getElementById('generatedLinkInput').value = roomUrl;
    document.getElementById('generatedLinkContainer').style.display = 'block';
    
    loadRooms();
});

// Load Data Room dengan Sorting & Search
async function loadRooms() {
    const search = document.getElementById('searchInput').value.trim();
    const sort = document.getElementById('sortSelect').value;
    const btnReset = document.getElementById('btnReset');

    if (search !== '' || sort !== 'created_desc') {
        btnReset.style.display = 'inline-block';
    } else {
        btnReset.style.display = 'none';
    }

    let query = supabaseClient.from('rooms').select('*');

    if (search) {
        query = query.ilike('room_code', `%${search}%`);
    }

    switch (sort) {
        case 'created_asc':
            query = query.order('created_at', { ascending: true });
            break;
        case 'expired_asc':
            query = query.order('expired_at', { ascending: true });
            break;
        case 'expired_desc':
            query = query.order('expired_at', { ascending: false });
            break;
        case 'created_desc':
        default:
            query = query.order('created_at', { ascending: false });
            break;
    }

    const { data: rooms, error } = await query;
    const tbody = document.getElementById('roomsTableBody');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Gagal memuat data.</td></tr>`;
        return;
    }

    if (!rooms || rooms.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#888; padding: 20px;">
            ${search ? 'Kode room tidak ditemukan.' : 'Belum ada room yang dibuat.'}
        </td></tr>`;
        return;
    }

    const now = new Date();
    tbody.innerHTML = rooms.map(r => {
        const expiredDate = new Date(r.expired_at);
        const createdDate = new Date(r.created_at);
        const isExpired = expiredDate < now;
        
        const roomUrl = `${window.location.origin}/msg.html?room=${r.room_code}`;
        const createdFormatted = createdDate.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
        const expiredFormatted = expiredDate.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
        
        const isoExpiredModal = expiredDate.toISOString().slice(0, 16);

        return `
            <tr>
                <td><strong>${r.room_code}</strong></td>
                <td>${createdFormatted}</td>
                <td>${expiredFormatted}</td>
                <td>
                    <span class="badge ${isExpired ? 'badge-expired' : 'badge-active'}">
                        ${isExpired ? 'Expired' : 'Aktif'}
                    </span>
                </td>
                <td>
                    <button class="btn-action btn-copy" onclick="copyLink('${roomUrl}')">Salin Link</button>
                    <button class="btn-action btn-share" onclick="shareInfo('${roomUrl}', '${createdFormatted}', '${expiredFormatted}')">Share</button>
                    <button class="btn-action btn-edit" onclick="openEditModal(${r.id}, '${r.room_code}', '${isoExpiredModal}')">Edit</button>
                </td>
            </tr>
        `;
    }).join('');
}

function resetFilter() {
    document.getElementById('searchInput').value = '';
    document.getElementById('sortSelect').value = 'created_desc';
    loadRooms();
}

// Edit Modal Functions
function openEditModal(id, code, currentExpiredAt) {
    document.getElementById('modal_room_id').value = id;
    document.getElementById('modal_room_code').innerText = code;
    document.getElementById('modal_expired_at').value = currentExpiredAt;
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('modal_room_id').value;
    const newExpiredAt = document.getElementById('modal_expired_at').value;

    const { error } = await supabaseClient
        .from('rooms')
        .update({ expired_at: new Date(newExpiredAt).toISOString() })
        .eq('id', id);

    if (error) {
        alert('Gagal memperbarui: ' + error.message);
        return;
    }

    closeEditModal();
    showAlert('Tanggal kadaluarsa berhasil diperbarui!');
    loadRooms();
});

// Copy & Share Clipboard Utilities
function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('Link room berhasil disalin!');
    });
}

function shareInfo(url, createdAt, expiredAt) {
    const shareText = `Link : ${url}\n` +
                      `Tgl. aktif : ${createdAt}\n` +
                      `Tgl. Kadaluarsa : ${expiredAt}`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Info link room berhasil disalin!');
        }).catch(() => fallbackCopyText(shareText));
    } else {
        fallbackCopyText(shareText);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert('Info link room berhasil disalin!');
    } catch (err) {
        alert('Gagal menyalin teks.');
    }
    document.body.removeChild(textArea);
}

window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
}

// Initial Fetch
loadRooms();
document.addEventListener('DOMContentLoaded', function() {
  const historyContainer = document.getElementById('historyContainer');
  const clearHistoryButton = document.getElementById('clearHistory');

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  function formatDynamicVariables(vars) {
    if (!vars || Object.keys(vars).length === 0) {
      return '<i>Yok</i>';
    }
    let html = '<ul>';
    for (const key in vars) {
      html += `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(vars[key]) || '<i>(boş)</i>'}</li>`;
    }
    html += '</ul>';
    return html;
  }

  function renderHistory() {
    chrome.storage.local.get(['promptHistoryLocal'], function(result) { // Changed to local and new key
      console.log('[HISTORY LOAD] Raw result from chrome.storage.local.get:', JSON.stringify(result, null, 2)); // Updated log
      const history = result.promptHistoryLocal || []; // Changed to new key
      console.log('[HISTORY LOAD] Extracted promptHistoryLocal array:', JSON.stringify(history, null, 2)); // Updated log

      if (history.length === 0) {
        historyContainer.innerHTML = '<p class="no-history">Henüz kaydedilmiş bir prompt bulunmuyor.</p>';
        return;
      }
      
      historyContainer.innerHTML = '';
      
      history.slice().reverse().forEach(function(item, index) { // Added index for logging
        console.log(`[HISTORY ITEM PROCESSING] Index: ${index} (reversed), Item:`, JSON.stringify(item, null, 2));
        const historyItemDiv = document.createElement('div');
        historyItemDiv.className = 'history-item';

        const date = new Date(item.timestamp);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        let contentHtml = `<h3>${escapeHtml(item.profileName || 'Bilinmeyen Profil')}</h3>`;
        contentHtml += `<p class="timestamp-model-info"><strong>Tarih:</strong> ${formattedDate} | <strong>Model:</strong> ${escapeHtml(item.model || 'N/A')} | <strong>İşleme Modu:</strong> ${escapeHtml(item.processingMode === 'interpretive' ? 'Yorumlayıcı' : 'Basit')}</p>`;

        // Summary (old turkishText) - can be used as a quick title or ignored
        // contentHtml += `<p><em>${escapeHtml(item.turkishText || '')}</em></p>`;

        contentHtml += `<div class="history-block"><strong>Ana Girdi:</strong><pre>${escapeHtml(item.mainInputText || 'Yok')}</pre></div>`;

        contentHtml += `<div class="history-block dynamic-vars"><strong>Dinamik Değişkenler:</strong>${formatDynamicVariables(item.dynamicVariableValues)}</div>`;

        if (item.processingMode === 'interpretive') {
          contentHtml += `<div class="history-block"><strong>Kullanılan Profil Talimatları:</strong><pre>${escapeHtml(item.profileInstructionsUsed || 'Yok')}</pre></div>`;
          contentHtml += `<div class="history-block"><strong>Meta Prompt (1. Aşama Gönderilen):</strong><pre>${escapeHtml(item.metaPromptSent || 'Yok')}</pre></div>`;
          contentHtml += `<div class="history-block"><strong>Yorumlanmış Prompt (1. Aşama Sonucu):</strong><pre>${escapeHtml(item.interpretedPromptText || 'Yok')}</pre></div>`;
          // finalPromptSent is same as interpretedPromptText for interpretive mode
        } else { // Simple mode
          contentHtml += `<div class="history-block"><strong>Kullanılan Profil Şablonu:</strong><pre>${escapeHtml(item.profileTemplateUsed || 'Yok')}</pre></div>`;
        }

        contentHtml += `<div class="history-block"><strong>Son Gönderilen Prompt:</strong><pre>${escapeHtml(item.finalPromptSent || 'Yok')}</pre></div>`;

        contentHtml += `<div class="history-block final-output"><strong>Yapay Zeka Yanıtı (Son Çıktı):</strong><pre>${escapeHtml(item.finalGeneratedResponse || 'Yanıt yok')}</pre></div>`;

        const textToCopy = item.finalGeneratedResponse || '';
        contentHtml += `<button class="copy-button" data-text-to-copy="${encodeURIComponent(textToCopy)}">Son Çıktıyı Kopyala</button>`;

        historyItemDiv.innerHTML = contentHtml;
        historyContainer.appendChild(historyItemDiv);
      });

      document.querySelectorAll('.copy-button').forEach(function(button) {
        button.addEventListener('click', function() {
          const text = decodeURIComponent(this.getAttribute('data-text-to-copy'));
          navigator.clipboard.writeText(text).then(function() {
            button.textContent = 'Kopyalandı!';
            setTimeout(function() { button.textContent = 'Son Çıktıyı Kopyala'; }, 2000);
          }).catch(err => {
            console.error('Kopyalama hatası: ', err);
            button.textContent = 'Hata!';
            setTimeout(function() { button.textContent = 'Son Çıktıyı Kopyala'; }, 2000);
          });
        });
      });
    });
  }

  clearHistoryButton.addEventListener('click', function() {
    if (confirm('Tüm geçmişi silmek istediğinizden emin misiniz?')) {
       chrome.storage.local.set({ 'promptHistoryLocal': [] }, function() { // Changed to local and new key
        renderHistory(); // Re-render to show empty state
        alert('Prompt geçmişi temizlendi.');
      });
    }
  });

  // Initial render
  renderHistory();
});

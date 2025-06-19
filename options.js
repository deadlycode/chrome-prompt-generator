document.addEventListener('DOMContentLoaded', function() {
  const modelSelect = document.getElementById('modelSelect');
  const modelInfo = document.getElementById('modelInfo');
  const apiSettingsStatus = document.getElementById('apiSettingsStatus'); // API status
  const profileGeneralStatus = document.getElementById('profileGeneralStatus'); // Profile general status
  const profileFormStatus = document.getElementById('profileFormStatus'); // Profile form error messages
  
  // Model açıklamaları
  const modelDescriptions = { // ... (rest of model descriptions remain the same)
    'gemini-2.5-pro': 'Gemini 2.5 Pro: Gelişmiş düşünme ve muhakeme, çok modlu anlama, gelişmiş kodlama için optimize edilmiş en güçlü kararlı model.',
    'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro Preview (06-05): Gelişmiş düşünme ve muhakeme, çok modlu anlama, gelişmiş kodlama için optimize edilmiş en güçlü modelin en son önizlemesi.',
    'gemini-2.5-flash': 'Gemini 2.5 Flash: Hız, ölçek ve maliyet verimliliği için optimize edilmiş yeni nesil kararlı model.',
    'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash Preview: Adaptif düşünme ve maliyet verimliliği için optimize edilmiş en yeni model.',
    'gemini-2.5-pro-preview-05-06': 'Gemini 2.5 Pro Preview: Gelişmiş düşünme ve muhakeme, çok modlu anlama, gelişmiş kodlama için optimize edilmiş en güçlü model.',
    'gemini-2.0-flash': 'Gemini 2.0 Flash: Yeni nesil özellikler, hız ve gerçek zamanlı akış için optimize edilmiş kararlı model.',
    'gemini-1.5-pro': 'Gemini 1.5 Pro: Daha fazla zeka gerektiren karmaşık muhakeme görevleri için optimize edilmiş model.'
  };
  const historyLimitSelect = document.getElementById('historyLimitSelect');
  
  // Model seçimi değiştiğinde açıklamayı güncelle
  modelSelect.addEventListener('change', function() {
    modelInfo.textContent = modelDescriptions[modelSelect.value] || "Model açıklaması bulunamadı.";
  });

  // Kayıtlı ayarları yükle
  chrome.storage.sync.get(['geminiApiKey', 'geminiModel', 'historyLimit'], function(result) {
    if (result.geminiApiKey) {
      document.getElementById('apiKey').value = result.geminiApiKey;
    }
    
    if (result.geminiModel) {
      modelSelect.value = result.geminiModel;
      if (modelDescriptions[result.geminiModel]) {
        modelInfo.textContent = modelDescriptions[result.geminiModel];
      } else {
        modelInfo.textContent = "Seçili model için açıklama bulunamadı.";
      }
    } else {
      modelSelect.value = 'gemini-2.5-flash-preview-05-20';
      modelInfo.textContent = modelDescriptions[modelSelect.value];
    }

    if (result.historyLimit) {
      historyLimitSelect.value = result.historyLimit;
    } else {
      historyLimitSelect.value = "100"; // Default value if not set
    }
  });

  // Kaydet butonuna tıklandığında (API, Model ve Geçmiş Limiti)
  document.getElementById('save').addEventListener('click', function() {
    const apiKey = document.getElementById('apiKey').value;
    const selectedModel = modelSelect.value;
    const selectedHistoryLimit = historyLimitSelect.value;
    
    chrome.storage.sync.set({
      geminiApiKey: apiKey,
      geminiModel: selectedModel,
      historyLimit: selectedHistoryLimit
    }, function() {
      if (chrome.runtime.lastError) {
        apiSettingsStatus.textContent = 'Hata: Ayarlar kaydedilemedi. ' + chrome.runtime.lastError.message;
        apiSettingsStatus.className = 'status error-message'; // Hata stili
      } else {
        apiSettingsStatus.textContent = 'Tüm ayarlar kaydedildi!';
        apiSettingsStatus.className = 'status success';
      }
      apiSettingsStatus.style.display = 'block';
      
      setTimeout(function() {
        apiSettingsStatus.style.display = 'none';
      }, 3000);
    });
  });

  // --- Profil Yönetimi ---
  let profiles = [];

  // const profileManagementContainer = document.getElementById('profileManagementContainer'); // Zaten var
  const addNewProfileButton = document.getElementById('addNewProfileButton');
  const profileList = document.getElementById('profileList');
  const profileForm = document.getElementById('profileForm');
  const profileNameInput = document.getElementById('profileNameInput');
  const profileDescriptionInput = document.getElementById('profileDescriptionInput');
  const profileTemplateInput = document.getElementById('profileTemplateInput');
  const profileIdInput = document.getElementById('profileIdInput');
  const saveProfileButton = document.getElementById('saveProfileButton');
  const cancelProfileButton = document.getElementById('cancelProfileButton');

  function showProfileFormError(message) {
    profileFormStatus.textContent = message;
    profileFormStatus.style.display = 'block';
  }

  function hideProfileFormError() {
    profileFormStatus.style.display = 'none';
  }

  function showProfileGeneralStatus(message, isSuccess = true) {
    profileGeneralStatus.textContent = message;
    profileGeneralStatus.className = isSuccess ? 'status success' : 'status error-message'; // Use error-message for errors
    profileGeneralStatus.style.display = 'block';
    setTimeout(() => {
        profileGeneralStatus.style.display = 'none';
    }, 3000);
  }


  function renderProfiles() {
    profileList.innerHTML = ''; // Clear existing list

    if (profiles.length === 0) {
      profileList.innerHTML = '<p style="text-align:center; color:#777;">Henüz profil oluşturulmamış. "Yeni Profil Ekle" ile başlayın!</p>';
      return;
    }

    // Newest first
    profiles.slice().reverse().forEach(profile => {
      const profileElement = document.createElement('div');
      profileElement.classList.add('profile-item');
      profileElement.innerHTML = `
        <h4>${escapeHTML(profile.name)}</h4>
        <p>${escapeHTML(profile.description) || '<i>Açıklama yok</i>'}</p>
        <div>
          <button class="edit-profile-button" data-id="${profile.id}">Düzenle</button>
          <button class="delete-profile-button" data-id="${profile.id}">Sil</button>
          <button class="duplicate-profile-button" data-id="${profile.id}">Kopyala</button>
        </div>
      `;
      profileList.appendChild(profileElement);

      // Event listeners for buttons
      profileElement.querySelector('.edit-profile-button').addEventListener('click', () => openProfileForm(profile));
      profileElement.querySelector('.delete-profile-button').addEventListener('click', () => deleteProfile(profile.id));
      profileElement.querySelector('.duplicate-profile-button').addEventListener('click', () => duplicateProfile(profile.id));
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (match) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[match];
    });
  }


  function loadProfiles() {
    chrome.storage.sync.get(['promptProfiles'], function(result) {
      if (result.promptProfiles) {
        profiles = result.promptProfiles.map(p => {
          if (!p.processingMode) {
            p.processingMode = "simple"; // Default for older profiles
          }
          return p;
        });
      } else {
        profiles = []; // Initialize if not present
      }
      renderProfiles();
    });
  }

  function saveProfiles(callback) {
    chrome.storage.sync.set({ 'promptProfiles': profiles }, function() {
      if (chrome.runtime.lastError) {
        showProfileGeneralStatus(`Hata: ${chrome.runtime.lastError.message}`, false);
        if (callback) callback(false);
      } else {
        if (callback) callback(true);
      }
    });
  }

  function openProfileForm(profile = null) {
    hideProfileFormError(); // Clear previous errors
    if (profile) {
      profileNameInput.value = profile.name;
      profileDescriptionInput.value = profile.description;
      profileTemplateInput.value = profile.template;
      profileIdInput.value = profile.id;
      profileForm.querySelector('h3').textContent = 'Profili Düzenle';
      // Set processing mode
      if (profile.processingMode === "interpretive") {
        document.getElementById('modeInterpretive').checked = true;
      } else {
        document.getElementById('modeSimple').checked = true; // Default
      }
    } else {
      profileNameInput.value = '';
      profileDescriptionInput.value = '';
      profileTemplateInput.value = '';
      profileIdInput.value = '';
      profileForm.querySelector('h3').textContent = 'Yeni Profil Ekle';
      document.getElementById('modeSimple').checked = true; // Default for new profiles
    }
    profileForm.style.display = 'block';
    profileNameInput.focus(); // Focus on the first input
  }

  function closeProfileForm() {
    profileNameInput.value = '';
    profileDescriptionInput.value = '';
    profileTemplateInput.value = '';
    profileIdInput.value = '';
    profileForm.style.display = 'none';
    hideProfileFormError();
  }

  addNewProfileButton.addEventListener('click', () => openProfileForm());
  cancelProfileButton.addEventListener('click', closeProfileForm);

  saveProfileButton.addEventListener('click', function() {
    hideProfileFormError(); // Clear previous errors
    const name = profileNameInput.value.trim();
    const description = profileDescriptionInput.value.trim();
    const template = profileTemplateInput.value.trim();
    const id = profileIdInput.value;
    const selectedMode = document.querySelector('input[name="processingMode"]:checked') ?
                         document.querySelector('input[name="processingMode"]:checked').value :
                         "simple"; // Default if somehow none is checked

    if (!name) {
      showProfileFormError('Profil ismi boş bırakılamaz.');
      // alert('Profil ismi boş bırakılamaz.'); // Eski alert
      profileNameInput.focus();
      return;
    }
    if (!template) {
      showProfileFormError('Prompt şablonu boş bırakılamaz.');
      // alert('Prompt şablonu boş bırakılamaz.'); // Eski alert
      profileTemplateInput.focus();
      return;
    }

    const isEditing = Boolean(id);
    if (isEditing) {
      const profileIndex = profiles.findIndex(p => p.id === id);
      if (profileIndex > -1) {
        profiles[profileIndex] = {
          ...profiles[profileIndex],
          name,
          description,
          template,
          processingMode: selectedMode
        };
      }
    } else {
      const newProfile = {
        id: 'profile_' + Date.now(),
        name,
        description,
        template,
        processingMode: selectedMode
      };
      profiles.push(newProfile);
    }

    saveProfiles((success) => {
        if(success){
            renderProfiles();
            closeProfileForm();
            showProfileGeneralStatus(isEditing ? 'Profil güncellendi!' : 'Profil kaydedildi!');
        } else {
            showProfileFormError('Profil kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.');
        }
    });
  });

  function deleteProfile(profileId) {
    if (confirm('Bu profili silmek istediğinizden emin misiniz?')) {
      profiles = profiles.filter(p => p.id !== profileId);
      saveProfiles((success) => {
        if(success){
            renderProfiles();
            showProfileGeneralStatus('Profil silindi.');
        } else {
            showProfileGeneralStatus('Profil silinirken bir hata oluştu.', false);
        }
      });
    }
  }

  function duplicateProfile(profileId) {
    const originalProfile = profiles.find(p => p.id === profileId);
    if (originalProfile) {
      const newProfile = {
        id: 'profile_' + Date.now(),
        name: originalProfile.name + ' (Kopya)',
        description: originalProfile.description,
        template: originalProfile.template
      };
      profiles.push(newProfile);
      saveProfiles((success) => {
        if(success){
            renderProfiles();
            showProfileGeneralStatus('Profil kopyalandı.');
        } else {
            showProfileGeneralStatus('Profil kopyalanırken bir hata oluştu.', false);
        }
      });
    }
  }

  // Initial load
  loadProfiles();
  profileForm.style.display = 'none'; // Ensure form is hidden initially

});

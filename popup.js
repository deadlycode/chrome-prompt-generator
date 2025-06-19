document.addEventListener('DOMContentLoaded', function() {
  // const input = document.getElementById('input'); // Artık doğrudan kullanılmıyor
  const generateButton = document.getElementById('generate');
  const result = document.getElementById('result');
  const error = document.getElementById('error');

  const profileSelectDropdown = document.getElementById('profileSelectDropdown');
  const userInputText = document.getElementById('userInputText'); // Yeni textarea
  const dynamicInputsContainer = document.getElementById('dynamicInputsContainer');
  const promptPreviewArea = document.getElementById('promptPreviewArea');

  let availableProfiles = []; // Yüklenen profilleri saklamak için
  let currentSelectedProfile = null; // Seçili profili saklamak için

  const historyButton = document.createElement('button');
  historyButton.textContent = 'Geçmişi Görüntüle';
  historyButton.className = 'history-button-style'; // Apply common style
  // historyButton.style.marginTop = '10px'; // Stil CSS'den gelecek
  // historyButton.style.width = '100%';
  // historyButton.style.backgroundColor = '#3498db'; // Stil CSS'den gelecek
  // historyButton.style.color = 'white';
  // historyButton.style.border = 'none';
  // historyButton.style.padding = '10px';
  // historyButton.style.borderRadius = '4px';
  // historyButton.style.cursor = 'pointer';
  
  historyButton.addEventListener('click', function() {
    chrome.tabs.create({ url: 'history.html' });
  });

  // Insert history button before the script tag, or at a specific point if layout is critical
  // document.body.appendChild(historyButton);
  // For better control, let's insert it after the result div
  result.parentNode.insertBefore(historyButton, result.nextSibling);


  function loadProfiles() {
    chrome.storage.sync.get(['promptProfiles'], function(result) {
      availableProfiles = result.promptProfiles || [];
      profileSelectDropdown.innerHTML = '<option value="" disabled selected>-- Bir Profil Seçin --</option>'; // Reset options
      availableProfiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name; // Should be HTML escaped if names can contain special chars, but for now it's fine
        profileSelectDropdown.appendChild(option);
      });

      // Restore last selected profile
      chrome.storage.local.get(['lastSelectedProfileId'], function(localResult) {
        if (localResult.lastSelectedProfileId) {
          const lastId = localResult.lastSelectedProfileId;
          if (availableProfiles.some(p => p.id === lastId)) {
            profileSelectDropdown.value = lastId;
          }
        }
        // Trigger handleProfileSelection even if no profile was restored, to set initial state
        handleProfileSelection();
      });
    });
  }

  function handleProfileSelection() {
    hideError(); // Hide any previous errors
    const selectedProfileId = profileSelectDropdown.value;
    dynamicInputsContainer.innerHTML = ''; // Clear previous inputs
    promptPreviewArea.textContent = ''; // Clear preview

    if (!selectedProfileId) {
      currentSelectedProfile = null;
      // chrome.storage.local.remove('lastSelectedProfileId'); // No need to remove, just don't set
      updatePromptPreview(); // Update preview to be empty
      return;
    }

    chrome.storage.local.set({ 'lastSelectedProfileId': selectedProfileId });
    currentSelectedProfile = availableProfiles.find(p => p.id === selectedProfileId);

    if (currentSelectedProfile && currentSelectedProfile.template) {
      const variableRegex = /\{([^}]+)\}/g;
      let match;
      const uniqueVariables = new Set();
      while ((match = variableRegex.exec(currentSelectedProfile.template)) !== null) {
        uniqueVariables.add(match[1]);
      }

      if (uniqueVariables.size > 0) {
        uniqueVariables.forEach(varName => {
          const varContainer = document.createElement('div');
          varContainer.className = 'dynamic-input-group'; // For styling

          const label = document.createElement('label');
          // Sanitize varName for display and for use in id (though dataset.variableName is safer for retrieval)
          const cleanVarName = varName.replace(/[^a-zA-Z0-9_]/g, '');
          label.textContent = `${varName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:`;
          label.htmlFor = `dyn_var_${cleanVarName}`;

          const input = document.createElement('input');
          input.type = 'text';
          input.id = `dyn_var_${cleanVarName}`;
          input.dataset.variableName = varName; // Store original varName here
          input.placeholder = `${varName.replace(/_/g, ' ')} değerini girin...`;

          input.addEventListener('input', updatePromptPreview);

          varContainer.appendChild(label);
          varContainer.appendChild(input);
          dynamicInputsContainer.appendChild(varContainer);
        });
      } else {
         dynamicInputsContainer.innerHTML = '<p style="font-size:0.9em; color:#555; text-align:center;">Bu profil için dinamik değişken bulunmuyor.</p>';
      }
      updatePromptPreview(); // Initial preview update
    }
  }

  function updatePromptPreview() {
    if (!currentSelectedProfile) {
      promptPreviewArea.textContent = 'Lütfen bir profil seçin.';
      return;
    }

    const processingMode = currentSelectedProfile.processingMode || "simple";
    const mainInputValue = userInputText.value; // Get main input regardless of mode for now

    if (processingMode === "interpretive") {
      let profileInstructionsTemplate = currentSelectedProfile.template || "";
      let processedProfileInstructions = profileInstructionsTemplate;

      // Substitute dynamic variables (excluding {USER_INPUT}) into profileInstructionsTemplate
      const dynamicVarInputs = dynamicInputsContainer.querySelectorAll('input[data-variable-name]');
      dynamicVarInputs.forEach(input => {
        const varName = input.dataset.variableName;
        // Do not replace {USER_INPUT} here for interpretive preview
        if (varName.toUpperCase() === "USER_INPUT") return;

        const regex = new RegExp(`\\{${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g');
        processedProfileInstructions = processedProfileInstructions.replace(regex, input.value || `{${varName}}`);
      });

      // Remove {USER_INPUT} placeholder from instructions preview if it exists, as its value is shown separately
      processedProfileInstructions = processedProfileInstructions.replace(/\{USER_INPUT\}/gi, '(Ana Girdi Yukarıda Gösteriliyor)');


      let previewText = "--- Yorumlayıcı Mod Önizlemesi ---\n\n";
      previewText += `Ana Girdiniz:\n"${mainInputValue || '(boş - prompt oluşturulurken girilmesi önerilir)'}"\n\n`;
      previewText += "Bu girdi, aşağıdaki talimatlarla (değişkenler doldurulmuş haliyle) AI tarafından işlenecektir:\n";
      previewText += `"${processedProfileInstructions || '(profilde talimat yok)'}"\n\n`;
      previewText += "(Nihai prompt, 'Prompt Oluştur' butonuna tıklandığında AI tarafından üretilecektir.)";

      promptPreviewArea.textContent = previewText;

    } else { // Simple mode
      if (!currentSelectedProfile.template) {
        promptPreviewArea.textContent = 'Bu profil için şablon bulunamadı.';
        return;
      }
      let templateToProcess = currentSelectedProfile.template;

      // 1. Replace {USER_INPUT}
      templateToProcess = templateToProcess.replace(/\{USER_INPUT\}/gi, mainInputValue || '');

      // 2. Replace other dynamic variables
      const dynamicVarInputs = dynamicInputsContainer.querySelectorAll('input[data-variable-name]');
      dynamicVarInputs.forEach(input => {
        const varName = input.dataset.variableName;
        const regex = new RegExp(`\\{${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g');
        templateToProcess = templateToProcess.replace(regex, input.value || `{${varName}}`);
      });
      promptPreviewArea.textContent = templateToProcess;
    }
  }

  generateButton.addEventListener('click', async function() {
    hideError(); // Clear previous errors

    if (!profileSelectDropdown.value || !currentSelectedProfile) {
      showError('Lütfen bir profil seçin.');
      return;
    }

    // Ensure currentSelectedProfile has processingMode, default to "simple" if not
    const processingMode = currentSelectedProfile.processingMode || "simple";
    const mainInputValue = userInputText.value.trim();
    const profileTemplate = currentSelectedProfile.template;

    // Validate common fields
    const { geminiApiKey, geminiModel } = await chrome.storage.sync.get(['geminiApiKey', 'geminiModel']);
    if (!geminiApiKey) {
      showError('Gemini API Anahtarı ayarlanmamış. Lütfen Seçenekler sayfasından ayarlayın.');
      return;
    }
    const modelToUse = geminiModel || 'gemini-2.5-flash-preview-05-20'; // Default model

    // Initial prompt construction based on preview (for simple mode or as final check for interpretive)
    let finalPromptForAPI = promptPreviewArea.textContent;

    if (finalPromptForAPI.match(/\{([^}]+)\}/g)) {
        showError('Lütfen tüm değişken alanlarını doldurun. Önizlemede {alan_adı} şeklinde yer tutucular kalmamalıdır.');
        return;
    }
    if (!finalPromptForAPI.trim() && processingMode === "simple") { // Only fail for simple if it's empty
        showError('Oluşturulan prompt boş olamaz (Basit Mod).');
        return;
    }
     if (!mainInputValue && processingMode === "interpretive" && profileTemplate.includes("{USER_INPUT}")) {
        showError('Yorumlayıcı modda ana girdi boş bırakılamaz eğer şablonda {USER_INPUT} kullanılıyorsa.');
        return;
    }


    generateButton.disabled = true;
    result.style.display = 'none';

    try {
      // Declare variables that might be used in history logging or across different paths
      let processedProfileInstructions = "";
      let metaPrompt = "";
      let interpretedPromptText = "";

      if (processingMode === "interpretive") {
        generateButton.textContent = "İşleniyor (1/2)...";

        // Assign to the already declared processedProfileInstructions
        processedProfileInstructions = profileTemplate;
        // Substitute dynamic variables into profileInstructionsTemplate
        const dynamicVarInputs = dynamicInputsContainer.querySelectorAll('input[data-variable-name]');
        dynamicVarInputs.forEach(input => {
          const varName = input.dataset.variableName;
          const regex = new RegExp(`\\{${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g');
          processedProfileInstructions = processedProfileInstructions.replace(regex, input.value || ''); // Replace with empty if not filled
        });

        // Remove {USER_INPUT} from instructions if it exists, as it's handled separately
        processedProfileInstructions = processedProfileInstructions.replace(/\{USER_INPUT\}/g, '').trim();


        const metaPrompt = `You are a highly skilled prompt engineering assistant. Your specific task is to synthesize the user's main subject with their guiding instructions to create a new, effective, and concise English image generation prompt. Do not add any conversational phrases, disclaimers, or explanations. Output ONLY the resulting image prompt.

User's main subject: "${mainInputValue}"
User's guiding instructions for prompt creation: "${processedProfileInstructions}"

Generated English image generation prompt:`;

        console.log('Interpretive Mode - Meta Prompt:', metaPrompt);

        const apiRequestBodyStep1 = {
          contents: [{ parts: [{ text: metaPrompt }] }],
          generationConfig: { temperature: 0.5, topK: 40, topP: 1, maxOutputTokens: 1024 }, // Slightly more deterministic
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        };

        console.log('API Request Body (Step 1 - Interpretive):', JSON.stringify(apiRequestBodyStep1, null, 2));
        const responseStep1 = await chrome.runtime.sendMessage({
          action: "makeApiRequest",
          url: `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiApiKey}`,
          body: apiRequestBodyStep1
        });
        console.log('Response from background.js (Step 1 - Interpretive):', JSON.stringify(responseStep1, null, 2));

        if (!responseStep1.success || !responseStep1.data.candidates || !responseStep1.data.candidates[0]?.content?.parts?.[0]?.text) {
          throw new Error('Dahili prompt yorumlama hatası: ' + (responseStep1.error || 'Geçersiz yanıt'));
        }
        interpretedPromptText = responseStep1.data.candidates[0].content.parts[0].text.trim();
        promptPreviewArea.textContent = interpretedPromptText; // Update preview with the interpreted prompt
        finalPromptForAPI = interpretedPromptText; // This will be used for the second call

        if (!finalPromptForAPI.trim()) {
            showError('Yorumlama sonucu boş bir prompt üretti. Lütfen ana girdiyi veya profil talimatlarını kontrol edin.');
            generateButton.textContent = 'Prompt Oluştur';
            generateButton.disabled = false;
            return;
        }
        generateButton.textContent = "İşleniyor (2/2)...";
      } else { // Simple mode
        generateButton.textContent = 'Oluşturuluyor...';
        // finalPromptForAPI is already set from promptPreviewArea.textContent
      }

      // --- Final API Call (Step 2 for interpretive, Step 1 for simple) ---
      const apiRequestBodyFinal = {
        contents: [{ parts: [{ text: finalPromptForAPI }] }],
        generationConfig: { temperature: 1.0, topK: 40, topP: 1, maxOutputTokens: 2048 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      };

      console.log(`API Request Body (${processingMode === 'interpretive' ? 'Step 2 - Final' : 'Simple Mode'}):`, JSON.stringify(apiRequestBodyFinal, null, 2));
      const finalResponse = await chrome.runtime.sendMessage({
        action: "makeApiRequest",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${geminiApiKey}`,
        body: apiRequestBodyFinal
      });
      console.log(`Response from background.js (${processingMode === 'interpretive' ? 'Step 2 - Final' : 'Simple Mode'}):`, JSON.stringify(finalResponse, null, 2));

      if (!finalResponse.success) {
        throw new Error(finalResponse.error || 'API yanıtında bilinmeyen bir hata oluştu.');
      }
      const finalData = finalResponse.data;
      if (!finalData.candidates || !finalData.candidates[0]?.content?.parts?.[0]?.text) {
        console.error("Unexpected API response structure (Final Call):", finalData);
        throw new Error('API yanıtı geçerli bir formatta değil veya içerik boş (Son Aşama).');
      }

      const finalGeneratedText = finalData.candidates[0].content.parts[0].text;
      result.textContent = finalGeneratedText;
      result.style.display = 'block'; // Display the final AI output

      // --- Enhanced History Logging using chrome.storage.local and historyLimit ---
      try {
        const dynamicVariableValues = {};
        const dynamicInputs = dynamicInputsContainer.querySelectorAll('input[data-variable-name]');
        dynamicInputs.forEach(input => {
          dynamicVariableValues[input.dataset.variableName] = input.value || '';
        });

        const baseHistoryEntry = {
          timestamp: new Date().toISOString(),
          model: modelToUse,
          profileId: currentSelectedProfile.id,
          profileName: currentSelectedProfile.name,
          processingMode: processingMode,
          mainInputText: mainInputValue,
          dynamicVariableValues: dynamicVariableValues,
          finalGeneratedResponse: finalGeneratedText
        };

        let summaryTurkishText = `[${baseHistoryEntry.profileName}]`;
        if (processingMode === "interpretive") {
          baseHistoryEntry.profileInstructionsUsed = processedProfileInstructions;
          baseHistoryEntry.metaPromptSent = metaPrompt;
          baseHistoryEntry.interpretedPromptText = interpretedPromptText;
          baseHistoryEntry.finalPromptSent = interpretedPromptText;
          summaryTurkishText += ` (Yorumlayıcı) - Girdi: ${baseHistoryEntry.mainInputText.substring(0,25)}${baseHistoryEntry.mainInputText.length > 25 ? '...' : ''}`;
        } else { // Simple mode
          baseHistoryEntry.profileTemplateUsed = currentSelectedProfile.template;
          baseHistoryEntry.finalPromptSent = finalPromptForAPI;
          summaryTurkishText += ` (Basit) - Girdi: ${baseHistoryEntry.mainInputText.substring(0,25)}${baseHistoryEntry.mainInputText.length > 25 ? '...' : ''}`;
        }
        baseHistoryEntry.turkishText = summaryTurkishText;

        console.log('[HISTORY SAVE ATTEMPT] baseHistoryEntry (to be saved to local):', JSON.stringify(baseHistoryEntry, null, 2));

        // 1. Get current historyLimit setting
        let historyLimit = 100; // Default
        const settings = await new Promise(resolve => chrome.storage.sync.get(['historyLimit'], resolve));
        if (settings && settings.historyLimit !== undefined) {
            historyLimit = parseInt(settings.historyLimit, 10);
        }
        console.log('[HISTORY] Using limit:', historyLimit === 0 ? 'Maksimum (Tarayıcı Limiti)' : historyLimit);

        // 2. Get current history array from local storage
        const localResult = await new Promise(resolve => chrome.storage.local.get(['promptHistoryLocal'], resolve));
        let history = localResult.promptHistoryLocal || [];
        console.log('[HISTORY LOAD] Loaded promptHistoryLocal array (length):', history.length);

        // 3. Add new entry
        history.push(baseHistoryEntry);

        // 4. Apply limit
        if (historyLimit > 0 && history.length > historyLimit) {
            history = history.slice(history.length - historyLimit);
            console.log('[HISTORY] Applied limit, new history length:', history.length);
        }

        // 5. Save updated history array to local storage
        await new Promise((resolve, reject) => {
            chrome.storage.local.set({ 'promptHistoryLocal': history }, function() {
                if (chrome.runtime.lastError) {
                    console.error('[HISTORY SAVE FAILED] Error saving to local:', chrome.runtime.lastError.message);
                    // Optionally, inform user: showError('Uyarı: Geçmiş girdisi kaydedilemedi. ' + chrome.runtime.lastError.message);
                    reject(chrome.runtime.lastError);
                } else {
                    console.log('[HISTORY SAVE SUCCESS] History array saved to local. New length:', history.length);
                    resolve();
                }
            });
        });
      } catch (histError) {
        console.error("Error during history saving process:", histError.message, histError.stack);
        // Non-critical, so don't necessarily show to user unless it's a persistent problem.
      }

    } catch (err) {
      console.error("Prompt generation error:", err.message, err.stack);
      showError('Hata: ' + err.message);
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Prompt Oluştur';
    }
  });

  function showError(message) {
    error.textContent = message;
    error.style.display = 'block';
    result.style.display = 'none'; // Sonucu gizle
  }

  function hideError() {
    error.style.display = 'none';
  }

  // Initialization
  loadProfiles();
  profileSelectDropdown.addEventListener('change', handleProfileSelection);
  userInputText.addEventListener('input', updatePromptPreview); // Add event listener for main input
});

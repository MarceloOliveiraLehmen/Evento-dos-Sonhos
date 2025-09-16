// ==== CONFIGURAÇÕES ====
const CLIENT_ID = "900102338405-42mi71ihsrr79b3t87iqebo64878qsrc.apps.googleusercontent.com";
const FOLDER_ID = "1Isxbk9nCJFFlRG9T7rT0LfO5M1k-cUs1";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// ==== VARIÁVEIS DE ESTADO ====
let tokenClient;
let gapiInited = false;
let gisInited = false;

// ==== INICIALIZAÇÃO ====
window.onload = () => {
  gapiLoaded();
  gisLoaded();
};

function gapiLoaded() {
  gapi.load('client', () => {
    gapi.client.init({
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    checkAndInit();
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleAuthResult,
  });
  gisInited = true;
  checkAndInit();
}

function checkAndInit() {
  if (gapiInited && gisInited) {
    document.getElementById("submitBtn").textContent = "Enviar lembranças 💌";
  }
}

async function handleAuthResult(resp) {
  if (resp.error) {
    console.error("Erro de autenticação:", resp.error);
    alert("Falha ao autorizar. Tente novamente.");
    return;
  }
  
  handleFileUpload();
}

// ==== ELEMENTOS ====
const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const uploadArea = document.getElementById("uploadArea");
const guestNameInput = document.getElementById("guestName");
const progressContainer = document.getElementById("uploadProgress");

// ==== UPLOAD UX ====
uploadArea.addEventListener("click", () => fileInput.click());
uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("dragover"); });
uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  fileInput.files = e.dataTransfer.files;
  showFileList();
  uploadArea.classList.remove("dragover");
});
fileInput.addEventListener("change", showFileList);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const guestName = guestNameInput.value.trim();
  if (!guestName || fileInput.files.length === 0) {
    alert("Por favor, preencha seu nome e selecione pelo menos um arquivo.");
    return;
  }
  
  tokenClient.requestAccessToken();
});

function showFileList() {
  const list = document.getElementById("fileList");
  list.innerHTML = "";
  Array.from(fileInput.files).forEach(f => {
    const item = document.createElement("div");
    item.className = "file-item";
    item.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`;
    list.appendChild(item);
  });
}

// ==== UPLOAD DE ARQUIVOS ====
async function handleFileUpload() {
  const guestName = guestNameInput.value.trim();
  const files = fileInput.files;
  
  progressContainer.innerHTML = "";
  document.getElementById("submitBtn").disabled = true;

  // Barra geral
  const overall = document.createElement("div");
  overall.className = "progress-item";
  overall.innerHTML = `
    <div class="progress-filename">Progresso total</div>
    <div class="progress-bar"><div class="progress-fill" id="overall-bar"></div></div>
    <div class="progress-text" id="overall-text">0%</div>`;
  progressContainer.appendChild(overall);

  let completed = 0;

  await Promise.all(
    Array.from(files).map((file, i) =>
      uploadSingleFile(file, guestName, i).then(() => {
        completed++;
        const pct = Math.round((completed / files.length) * 100);
        document.getElementById("overall-bar").style.width = pct + "%";
        document.getElementById("overall-text").textContent = pct + "%";
      })
    )
  );

  // Finalização
  document.getElementById("successMessage").classList.add("show");

  // Oculta a mensagem e reseta o formulário após 5 segundos
  setTimeout(() => {
    document.getElementById("successMessage").classList.remove("show");
    form.reset();
    showFileList();
    document.getElementById("submitBtn").disabled = false;
    progressContainer.innerHTML = "";
  }, 2000); // 2000ms = 2 segundos
}

async function uploadSingleFile(file, guestName, index) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const cleanName = guestName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const newName = `${cleanName}_${timestamp}_${file.name}`;

  const item = document.createElement("div");
  item.className = "progress-item";
  item.innerHTML = `
    <div class="progress-filename">${file.name}</div>
    <div class="progress-bar"><div class="progress-fill" id="bar-${index}"></div></div>
    <div class="progress-text" id="text-${index}">Preparando...</div>`;
  progressContainer.appendChild(item);

  return new Promise((resolve) => {
    try {
      const metadata = { name: newName, parents: [FOLDER_ID] };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", file);
      const token = gapi.auth.getToken().access_token;
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
      xhr.setRequestHeader("Authorization", "Bearer " + token);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = (e.loaded / e.total) * 100;
          document.getElementById(`bar-${index}`).style.width = pct + "%";
          document.getElementById(`text-${index}`).textContent = Math.round(pct) + "%";
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          document.getElementById(`bar-${index}`).style.width = "100%";
          document.getElementById(`text-${index}`).textContent = "Concluído ✓";
        } else {
          document.getElementById(`bar-${index}`).style.background = "#dc3545";
          document.getElementById(`text-${index}`).textContent = "Erro ✗";
        }
        resolve();
      };

      xhr.onerror = () => {
        document.getElementById(`bar-${index}`).style.background = "#dc3545";
        document.getElementById(`text-${index}`).textContent = "Erro rede ✗";
        resolve();
      };

      xhr.send(form);
    } catch (err) {
      console.error("Erro upload:", err);
      document.getElementById(`bar-${index}`).style.background = "#dc3545";
      document.getElementById(`text-${index}`).textContent = "Erro ✗";
      resolve();
    }
  });
}



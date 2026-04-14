document.addEventListener("DOMContentLoaded", () => {
  const workflowStages = [
    "Application",
    "Concept Note",
    "Proposal",
    "Research Progress",
    "Thesis Submission",
    "Defense",
    "Graduation",
  ];

  const legacyAliases = {
    "coursework": "Application",
    "concept note (department)": "Concept Note",
    "concept note (school)": "Concept Note",
    "concept note": "Concept Note",
    "proposal (department)": "Proposal",
    "proposal (school)": "Proposal",
    "proposal": "Proposal",
    "fieldwork": "Research Progress",
    "research progress": "Research Progress",
    "data collection": "Research Progress",
    "data collection & fieldwork": "Research Progress",
    "draft thesis": "Thesis Submission",
    "notice of submission": "Thesis Submission",
    "thesis submission": "Thesis Submission",
    "external examination": "Thesis Submission",
    seminar: "Defense",
    examination: "Defense",
    corrections: "Defense",
    clearance: "Graduation",
  };

  const pipelineContainer = document.getElementById("pipelineStages");
  const currentStatusDisplay = document.getElementById("currentStatusDisplay");

  function normalizeStage(rawStage) {
    if (typeof rawStage === "number" && Number.isFinite(rawStage)) {
      return workflowStages[Math.min(workflowStages.length, Math.max(1, Math.round(rawStage))) - 1];
    }

    const value = (rawStage || "").toString().trim();
    if (!value) return workflowStages[0];

    if (/^\d+$/.test(value)) {
      return workflowStages[Math.min(workflowStages.length, Math.max(1, Number(value))) - 1];
    }

    const alias = legacyAliases[value.toLowerCase()];
    if (alias) return alias;

    return workflowStages.find((stage) => stage.toLowerCase() === value.toLowerCase()) || workflowStages[0];
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem("postgraduate_user")) || JSON.parse(localStorage.getItem("userInfo"));
    } catch (error) {
      console.error("Error reading stored user:", error);
      return null;
    }
  }

  function renderPipeline(currentStage) {
    pipelineContainer.innerHTML = "";
    const targetIndex = workflowStages.indexOf(currentStage);

    workflowStages.forEach((stage, index) => {
      const stageDiv = document.createElement("div");
      stageDiv.classList.add("stage");

      if (index < targetIndex) {
        stageDiv.classList.add("completed");
        stageDiv.textContent = `Complete: ${stage}`;
      } else if (index === targetIndex) {
        stageDiv.classList.add("active");
        stageDiv.textContent = `Current: ${stage}`;
      } else {
        stageDiv.textContent = `Upcoming: ${stage}`;
      }

      pipelineContainer.appendChild(stageDiv);

      if (index < workflowStages.length - 1) {
        const arrowDiv = document.createElement("div");
        arrowDiv.classList.add("arrow");
        arrowDiv.textContent = "v";
        pipelineContainer.appendChild(arrowDiv);
      }
    });
  }

  const userInfo = getStoredUser();
  const currentStage = normalizeStage(userInfo?.stage || userInfo?.currentStage || userInfo?.stageName);
  currentStatusDisplay.textContent = currentStage;
  renderPipeline(currentStage);
});

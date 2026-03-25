document.addEventListener("DOMContentLoaded", () => {
    const journeyStages = [
        "Concept Note",
        "Proposal",
        "Data Collection",
        "Draft Thesis",
        "Notice of Submission",
        "Seminar",
        "Final Thesis",
        "Examination",
        "Corrections",
        "Clearance",
        "Graduation"
    ];

    const pipelineContainer = document.getElementById("pipelineStages");
    const currentStatusDisplay = document.getElementById("currentStatusDisplay");

    async function fetchUserStage() {
        try {
            // Check if user info exists in localStorage
            const userInfo = JSON.parse(localStorage.getItem("userInfo"));
            let currentStage = "Concept Note"; // default
            
            if (userInfo && userInfo.stage) {
                currentStage = userInfo.stage;
            } else if (userInfo && userInfo._id) {
                // Fetch up-to-date profile if endpoint exists or just use mock for demonstration if needed.
                // const response = await fetch(`/api/user/profile/${userInfo._id}`);
                // const data = await response.json();
                // currentStage = data.stage;
            }

            // Fallback for demonstration
            if (!currentStage) currentStage = "Seminar"; 

            currentStatusDisplay.textContent = currentStage;
            renderPipeline(currentStage);
        } catch (error) {
            console.error("Error fetching stage:", error);
            currentStatusDisplay.textContent = "Error loading stage";
            renderPipeline("Concept Note");
        }
    }

    function renderPipeline(currentStage) {
        pipelineContainer.innerHTML = '';
        const targetIndex = journeyStages.indexOf(currentStage);

        journeyStages.forEach((stage, index) => {
            const stageDiv = document.createElement("div");
            stageDiv.classList.add("stage");
            
            if (index < targetIndex) {
                stageDiv.classList.add("completed");
                stageDiv.textContent = `✅ ${stage} (Completed)`;
            } else if (index === targetIndex) {
                stageDiv.classList.add("active");
                stageDiv.textContent = `📍 ${stage} (Current)`;
            } else {
                stageDiv.textContent = `⏳ ${stage}`;
            }
            
            pipelineContainer.appendChild(stageDiv);

            if (index < journeyStages.length - 1) {
                const arrowDiv = document.createElement("div");
                arrowDiv.classList.add("arrow");
                arrowDiv.textContent = "⬇";
                pipelineContainer.appendChild(arrowDiv);
            }
        });
    }

    fetchUserStage();
});

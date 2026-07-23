const activationForm =
  document.getElementById("activationForm");

const emailInput =
  document.getElementById("activationEmail");

const accessKeyInput =
  document.getElementById("activationAccessKey");

const activationMessage =
  document.getElementById("activationMessage");

const activateButton =
  document.getElementById("activateMasterForgeBtn");

const minimiseButton =
  document.getElementById("activationMinBtn");

const closeButton =
  document.getElementById("activationCloseBtn");


const activationErrorMessages = {
  invalid_email:
    "Please enter the approved email address used for your Alpha application.",

  invalid_key:
    "That access key is missing or invalid. Check the key and try again.",

  email_key_mismatch:
    "That email address does not match the supplied access key.",

  tester_not_approved:
    "This tester account has not yet been approved for Alpha access.",

  key_revoked:
    "This access key has been revoked. Please contact MasterForge Studio support.",

  activation_limit_reached:
    "This access key has reached its permitted activation limit. Please contact MasterForge Studio support.",

  machine_mismatch:
    "This licence is registered to another installation. Please contact MasterForge Studio support.",

  unsupported_platform:
    "This access key does not support your current operating system.",

  unsupported_version:
    "This version of MasterForge Studio is not supported by your access key. Please install the approved Alpha version.",

  invalid_license_token:
    "The stored licence is no longer valid. Please activate MasterForge Studio again.",

  reactivation_required:
    "Full licence reactivation is required. Enter your approved email address and access key again.",

  machine_id_error:
    "MasterForge Studio could not identify this installation. Please restart the app and try again.",

  network_error:
    "MasterForge Studio could not contact the activation server. Check your internet connection and try again.",

  server_error:
    "The activation server could not complete the request. Please try again or contact support.",
};



function showActivationMessage(
  message,
  type = "error"
) {
  activationMessage.textContent = message;

  activationMessage.className =
    `activationMessage ${type}`;
}


function hideActivationMessage() {
  activationMessage.textContent = "";

  activationMessage.className =
    "activationMessage hidden";
}


function setActivationLoading(isLoading) {
  activateButton.disabled = isLoading;
  emailInput.disabled = isLoading;
  accessKeyInput.disabled = isLoading;

  activateButton.textContent =
    isLoading
      ? "Activating..."
      : "Activate MasterForge Studio";
}


function getActivationErrorMessage(errorCode) {
  return (
    activationErrorMessages[errorCode] ||
    "MasterForge Studio could not be activated. Please check your details and try again."
  );
}

async function loadActivationScreenState() {
  if (
    !window.dmAPI ||
    typeof window.dmAPI.getActivationScreenState !==
      "function"
  ) {
    return;
  }

  try {
    const screenState =
      await window.dmAPI.getActivationScreenState();

    if (screenState?.email) {
      emailInput.value =
        screenState.email;
    }

    if (screenState?.reason) {
      showActivationMessage(
        getActivationErrorMessage(
          screenState.reason
        )
      );
    }
  } catch (error) {
    console.error(
      "Unable to read activation screen state:",
      error
    );
  }
}

accessKeyInput.addEventListener(
  "input",
  () => {
    accessKeyInput.value =
      accessKeyInput.value.toUpperCase();
  }
);


activationForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    hideActivationMessage();

    const email =
      emailInput.value.trim().toLowerCase();

    const accessKey =
      accessKeyInput.value.trim().toUpperCase();

    if (!email) {
      showActivationMessage(
        activationErrorMessages.invalid_email
      );

      emailInput.focus();
      return;
    }

    if (!accessKey) {
      showActivationMessage(
        activationErrorMessages.invalid_key
      );

      accessKeyInput.focus();
      return;
    }

    if (
      !window.dmAPI ||
      typeof window.dmAPI.activateLicence !==
        "function"
    ) {
      showActivationMessage(
        "The activation service is unavailable. Please restart MasterForge Studio."
      );

      return;
    }

    setActivationLoading(true);

    showActivationMessage(
      "Contacting the MasterForge Studio activation server...",
      "info"
    );

    try {
      const result =
        await window.dmAPI.activateLicence(
          email,
          accessKey
        );

      if (!result?.valid) {
        showActivationMessage(
          getActivationErrorMessage(
            result?.error
          )
        );

        return;
      }

      showActivationMessage(
        "Activation successful. MasterForge Studio is ready to unlock.",
        "success"
      );

      accessKeyInput.value = "";
    } catch (error) {
      console.error(
        "Activation interface error:",
        error
      );

      showActivationMessage(
        activationErrorMessages.server_error
      );
    } finally {
      setActivationLoading(false);
    }
  }
);


minimiseButton.addEventListener(
  "click",
  () => {
    window.dmAPI?.minimizeWindow?.();
  }
);


closeButton.addEventListener(
  "click",
  () => {
    window.dmAPI?.closeWindow?.();
  }
);

loadActivationScreenState();
const instantOpenCheckbox = document.getElementById('instantOpenCheckbox');
const createClipLinkCheckbox = document.getElementById('createClipLinkCheckbox');
const disableAutocompleteCheckbox = document.getElementById('disableAutocompleteCheckbox');

let userOptions = {};

chrome.storage.local.get(['options'], (data) => {
    userOptions = data.options || {//Set defaults if none exist
      instantOpen: false,
      createClipLink: true,
      disableAutocomplete: false
    };
    //sets the checkboxes to saved options values.
    instantOpenCheckbox.checked = userOptions.instantOpen;
    createClipLinkCheckbox.checked = userOptions.createClipLink;
    disableAutocompleteCheckbox.checked = userOptions.disableAutocomplete;
});

//changing the checkboxes will update the database
instantOpenCheckbox.addEventListener('change', () => {
  userOptions.instantOpen = instantOpenCheckbox.checked;
  chrome.storage.local.set({ options: userOptions });
});

createClipLinkCheckbox.addEventListener('change', () => {
  userOptions.createClipLink = createClipLinkCheckbox.checked;
  chrome.storage.local.set({ options: userOptions });
});

disableAutocompleteCheckbox.addEventListener('change', () => {
  userOptions.disableAutocomplete = disableAutocompleteCheckbox.checked;
  chrome.storage.local.set({ options: userOptions });
});

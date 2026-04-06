import { runAppleScript } from "run-applescript";
import { LocalStorage, open, popToRoot } from "@raycast/api";
import { SettingsProfileOpenBehaviour, Tab } from "../interfaces";
import { NOT_INSTALLED_MESSAGE } from "../constants";
import { runAppleScript as runAppleScriptRaycast, showFailureToast } from "@raycast/utils";

export async function getOpenTabs(useOriginalFavicon: boolean): Promise<Tab[]> {
  const sep = Tab.TAB_CONTENTS_SEPARATOR
  try {
    const openTabs = await runAppleScript(`
      set _outputList to {}
      tell application "Google Chrome"
        set _windows to windows
        repeat with w in _windows
          set _win_id to id of w
          set _titles to title of tabs of w
          set _urls to URL of tabs of w
          repeat with _tab_index from 1 to count of _titles
            set _title to item _tab_index of _titles
            set _url to item _tab_index of _urls
            set _favicon to ""
            set end of _outputList to (_title & "${sep}" & _url & "${sep}" & _favicon & "${sep}" & _win_id & "${sep}" & _tab_index)
          end repeat
        end repeat
      end tell

      set AppleScript's text item delimiters to "\\n"
      set _output to _outputList as string
      set AppleScript's text item delimiters to ""

      return _output
  `);

    return openTabs
      .split("\n")
      .filter((line) => line.length !== 0)
      .map((line) => Tab.parse(line))
      .filter((tab) => tab.url != "chrome://newtab/");
  } catch (err) {
    if ((err as Error).message.includes('Can\'t get application "Google Chrome"')) {
      LocalStorage.removeItem("is-installed");
    }
    await checkAppInstalled();
    return [];
  }
}

export async function openNewTab({
  url,
  query,
  profileCurrent,
  profileOriginal,
  openTabInProfile,
}: {
  url?: string;
  query?: string;
  profileCurrent: string;
  profileOriginal?: string;
  openTabInProfile: SettingsProfileOpenBehaviour;
}): Promise<boolean | string> {
  await checkAppInstalled();

  let script = "";

  const getOpenInProfileCommand = (profile: string) =>
    `
    set profile to quoted form of "${profile}"
    set link to quoted form of "${url ? url : "about:blank"}"
    do shell script "open -na 'Google Chrome' --args --profile-directory=" & profile & " " & link
  `;

  switch (openTabInProfile) {
    case SettingsProfileOpenBehaviour.Default:
      script =
        `
        set winExists to false
        tell application "Google Chrome"
            repeat with win in every window
                if index of win is 1 then
                    set winExists to true
                    exit repeat
                end if
            end repeat

            if not winExists then
                make new window
            else
                activate
            end if

            tell window 1
                set newTab to make new tab ` +
        (url
          ? `with properties {URL:"${url}"}`
          : query
            ? 'with properties {URL:"https://www.google.com/search?q=' + query + '"}'
            : "") +
        `
            end tell
        end tell
        return true

  `;
      break;
    case SettingsProfileOpenBehaviour.ProfileCurrent:
      script = getOpenInProfileCommand(profileCurrent);
      break;
    case SettingsProfileOpenBehaviour.ProfileOriginal:
      script = getOpenInProfileCommand(profileOriginal!);
      break;
  }

  try {
    await runAppleScriptRaycast(script);
    await popToRoot({ clearSearchBar: true });
    return true;
  } catch (error) {
    await showFailureToast(error);
    return false;
  }
}

export async function setActiveTab(tab: Tab): Promise<void> {
  await open(
    `hammerspoon://activate_browser_tab?window=${tab.windowsId}&tab=${tab.tabIndex}`
  )
}

export async function closeActiveTab(tab: Tab): Promise<void> {
  await runAppleScript(`
    tell application "Google Chrome"
      activate
      set _wnd to first window where id is ${tab.windowsId}
      set index of _wnd to 1
      set active tab index of _wnd to ${tab.tabIndex}
      close active tab of _wnd
    end tell
    return true
  `);
}

export async function reloadTab(tab: Tab): Promise<void> {
  await runAppleScript(`
    tell application "Google Chrome"
      activate
      set _wnd to first window where id is ${tab.windowsId}
      set index of _wnd to 1
      set active tab index of _wnd to ${tab.tabIndex}
      tell active tab of _wnd to reload
    end tell
    return true
  `);
}

const checkAppInstalled = async () => {
  const installed = await LocalStorage.getItem("is-installed");
  if (installed) return;

  const appInstalled = await runAppleScript(`
set isInstalled to false
try
    do shell script "osascript -e 'exists application \\"Google Chrome\\"'"
    set isInstalled to true
end try

return isInstalled`);
  if (appInstalled === "false") {
    throw new Error(NOT_INSTALLED_MESSAGE);
  }
  LocalStorage.setItem("is-installed", true);
};

export async function createNewWindow(): Promise<void> {
  await runAppleScript(`
    tell application "Google Chrome"
      make new window
      activate
    end tell
    return true
  `);
}

export async function createNewWindowToWebsie(website: string): Promise<void> {
  await runAppleScript(`
    tell application "Google Chrome"
      make new window
      open location "${website}"
      activate
    end tell
    return true
  `);
}

export async function createNewTab(): Promise<void> {
  await runAppleScript(`
    tell application "Google Chrome"
      make new tab at end of tabs of window 1
      activate
    end tell
    return true
  `);
}

export async function createNewTabToWebsite(website: string): Promise<void> {
  await runAppleScript(`
    tell application "Google Chrome"
      activate
      open location "${website}"
    end tell
    return true
  `);
}

export async function createNewIncognitoWindow(): Promise<void> {
  await runAppleScript(`
    tell application "Google Chrome"
      make new window with properties {mode:"incognito"}
      activate
    end tell
    return true
  `);
}

export async function createNewGuestWindow(): Promise<void> {
  // Use `open` with --args --guest to ensure guest mode even when AppleScript doesn't support it.
  await checkAppInstalled();

  await runAppleScript(`
    do shell script "open -na 'Google Chrome' --args --guest"
  `);
}

export async function createNewGuestWindowToWebsite(website: string): Promise<void> {
  await checkAppInstalled();
  await runAppleScript(`
    set link to quoted form of "${website}"
    do shell script "open -na 'Google Chrome' --args --guest " & link
  `);
}

export async function nameCurrentWindow(): Promise<void> {
  await checkAppInstalled();
  await runAppleScript(`
    tell application "Google Chrome" to activate
    tell application "System Events"
      tell process "Google Chrome"
        click menu item "Name Window…" of menu "Window" of menu bar 1
      end tell
    end tell
  `);
}

export async function getActiveTabURL(): Promise<string> {
  await checkAppInstalled();

  const url = await runAppleScript(`
    tell application "Google Chrome"
      try
        return URL of active tab of front window
      on error
        return ""
      end try
    end tell
  `);

  return url;
}

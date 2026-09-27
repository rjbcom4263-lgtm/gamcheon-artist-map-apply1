export const PROFILE_EDITOR_ID = "artist-profile-editor";
export const EDITABLE_APPLICATION_QUERY = `SELECT id, artist_name, phone, email, status, payload_json, image_keys_json, created_at
  FROM artist_applications
  WHERE status = 'approved' AND account_id = ?
  ORDER BY created_at DESC LIMIT 1`;

export function profileEditorControl(action: "show" | "hide") {
  return { type: "button" as const, popoverTarget: PROFILE_EDITOR_ID, popoverTargetAction: action };
}

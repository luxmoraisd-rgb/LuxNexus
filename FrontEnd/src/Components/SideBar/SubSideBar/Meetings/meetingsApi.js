const BASE_URL = "/api";

const request = async (path, options = {}) => {
  const token =
    typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(
      data?.detail || data?.message || `Meeting request failed (${response.status}).`
    );
  }
  return data;
};

export async function fetchMeetings(params = {}) {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.search) query.set("search", params.search);
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`/meetings/${suffix}`);
}

export async function createMeeting(meetingData) {
  return request("/meetings/", {
    method: "POST",
    body: JSON.stringify(meetingData),
  });
}

export async function deleteMeeting(id) {
  return request(`/meetings/${encodeURIComponent(id)}/`, { method: "DELETE" });
}

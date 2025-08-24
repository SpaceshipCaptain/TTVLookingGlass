browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "openOptionsPage") {
        browser.tabs.create({ url: browser.runtime.getURL("options/options.html") });
        return;
    }

    if (message.type === "apiRequest") {
        handleApiRequest(message.payload)
            .then(res => {
                sendResponse({ ok: true, data: res });
            })
            .catch(err => {
                sendResponse({
                    ok: false,
                    error: {
                        message: err.message,
                        type: err.type || 'unknown',
                        status: err.status,
                        site: message.payload.site
                    }
                });
            });
        return true;
    }
});

function createError(type, message, status, site = null) {
    const error = new Error(message);
    error.type = type;
    error.status = status;
    error.site = site;
    return error;
}

async function handleApiRequest({ site, queryType, slug, username, nVods }) {
    if (site === "twitch") {
        if (queryType === "video") {
            const query = videoQuery(slug);
            const rawData = await twitchApi(query)
            return shapeTwitchVideo(rawData);
        }
        if (queryType === "clip") {
            const query = clipQuery(slug);
            const rawData = await twitchApi(query)
            return shapeTwitchClip(rawData);
        }
        if (queryType === "userVideos") {
            const query = userVideosQuery(username, nVods);
            const rawData = await twitchApi(query)
            return normalizeTwitchUserVideos(rawData)
        }
    }
    if (site === "kick") {
        if (queryType === "video") {
            const endpoint = `https://kick.com/api/v1/video/${slug}`;
            const rawData = await kickApi(endpoint);
            return shapeKickVideo(rawData);
        }

        if (queryType === "clip") {
            const clipEndpoint = `https://kick.com/api/v2/clips/${slug}`;
            const clipData = await kickApi(clipEndpoint);

            // If clip has a vod attached, fetch the vod data too
            let vodData = null;
            if (clipData.clip && clipData.clip.vod && clipData.clip.vod.id) {
                const vodEndpoint = `https://kick.com/api/v1/video/${clipData.clip.vod.id}`;
                vodData = await kickApi(vodEndpoint);
            }
            // if the clip is from a still live broadcast, get the first video
            if (!vodData && clipData.clip.is_live) {
                const endpoint = `https://kick.com/api/v2/channels/${clipData.clip.channel.username}/videos`;
                const videos = await kickApi(endpoint)
                // if the first video is the current broadcast use it's created_at timestamp
                if (videos[0].is_live) {
                    vodData = videos[0].video
                }
            }
            return shapeKickClip(clipData, vodData);
        }

        if (queryType === "userVideos") {
            const endpoint = `https://kick.com/api/v2/channels/${username}/videos`;
            const rawData = await kickApi(endpoint);
            return normalizeKickUserVideos(rawData, username);
        }
    }
}

async function twitchApi(query) {
    try {
        const response = await fetch("https://gql.twitch.tv/gql", {
            method: "POST",
            headers: { "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko" },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw createError('api_error', `Twitch API error: ${response.status}`, response.status, 'twitch');
        }

        const json = await response.json();

        return json.data;
    } catch (error) {
        if (error.type) throw error;
        throw createError('network_error', `Failed to connect to Twitch: ${error.message}`, null, 'twitch');
    }
}

async function kickApi(endpoint) {
    try {
        const response = await fetch(endpoint);

        if (!response.ok) {
            if (response.status === 404) {
                throw createError('not_found', 'Resource not found on Kick', 404, 'kick');
            }
            throw createError('api_error', `Kick API error: ${response.status}`, response.status, 'kick');
        }

        const json = await response.json();
        return json;
    } catch (error) {
        if (error.type) throw error;
        throw createError('network_error', `Failed to connect to Kick: ${error.message}`, null, 'kick');
    }
}

// UserVideos needs to be the same shape between APIs
function normalizeTwitchUserVideos(data) {
    if (!data || !data.user) {
        throw createError('not_found', 'Twitch user not found', 404, 'twitch');
    }
    return {
        login: data.user.login,
        displayName: data.user.displayName,
        videos: data.user.videos.edges.map(edge => ({
            link: `https://twitch.tv/videos/${edge.node.id}`,
            createdAt: edge.node.createdAt,
            durationSeconds: edge.node.lengthSeconds
        }))
    }
}

function normalizeKickUserVideos(data, username) {
    return {
        login: username,
        displayName: username,
        videos: data.map(videoData => {
            let durationSeconds;
            if (videoData.is_live && videoData.duration === 0) {
                const startTime = Date.parse(videoData.video.created_at);
                const now = Date.now();
                durationSeconds = Math.floor((now - startTime) / 1000);
            } else {
                durationSeconds = Math.floor(videoData.duration / 1000);
            }
            return {
                link: `https://kick.com/${username}/videos/${videoData.video.uuid}`,
                createdAt: videoData.video.created_at,
                durationSeconds: durationSeconds
            };
        })
    }
}

function shapeTwitchVideo(data) {
    return {
        createdAt: data.video.createdAt,
        broadcastType: data.video.broadcastType,
    }
}

function shapeTwitchClip(data) {
    return {
        login: data.clip.broadcaster.login,
        createdAt: data.clip.createdAt,
        vodOffsetSeconds: data.clip.videoOffsetSeconds,
        vod: data.clip.video
    }
}

// twitch uses createdAt and kick uses created_at
// everything should be sent as createdAt
function shapeKickVideo(data) {
    return {
        createdAt: data.created_at,
    };
}

function shapeKickClip(clipData, vodData) {
    return {
        login: clipData.clip.channel.slug,
        createdAt: clipData.clip.created_at,
        vodOffsetSeconds: clipData.clip.vod_starts_at,
        vod: vodData ? {
            createdAt: vodData.created_at,
        } : null
    };
}

function videoQuery(input) {
    return `query {
        video(id: "${input}") {
            createdAt
            broadcastType
        }
    }`;
}

function userVideosQuery(input, nVods) {
    return `query {
        user(login: "${input}") {
            videos(first:${nVods}, type: ARCHIVE) {
                edges {
                    node {
                        id
                        createdAt
                        lengthSeconds
                    }
                }
            }
            login
            displayName
        }
    }`;
}

function clipQuery(input) {
    return `query {
        clip(slug: "${input}") {
            broadcaster{
                login
            }
            createdAt
            videoOffsetSeconds
            video{
                id
                createdAt
            }
        }
    }`;
}

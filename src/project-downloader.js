//Originally was gonna use sb-downloader api, but that was to confusing to implement builds here,
//so simply im gonna use my own created one.
//Credit for TurboWarp for making their own trampoline so I don't have to make my own.
//Requires JSZip.
//If you are going to use this for you're own custom programs, please credit (although i spent little time making this mini-module script).

var JSZip = window.JSZip;

async function fetchJSON(url,options) {
	var response = await fetch(url,options);
	var text = await response.text();
	var json = JSON.parse(text);
	return json;
}

async function fetchArrayBuffer(url,options) {
	var response = await fetch(url,options);
	var arrayBuffer = await response.arrayBuffer();
	return arrayBuffer;
}

function getAPIURL (id) {
	return `https://trampoline.turbowarp.org/api/projects/${id}`;
}

function getJSONURL (id,token) {
	return `https://projects.scratch.mit.edu/${id}?token=${token}`;
}

function getAssetURL (asset) {
	return `https://assets.scratch.mit.edu/internalapi/asset/${asset}/get/`;
}

function getProjectToken (json) {
	return json.project_token;
}

function downloadScratchProject(id,event) {
	return new Promise(async function (accept,reject) {
		try{
			var error = false;
			var dothing = event;
			if (!dothing) {
				dothing = function () {};
			}
			dothing("fetch_json");
			var info = await fetchJSON(getAPIURL(id));
			dothing("info",info);
			var token = getProjectToken(info);
			dothing("token",token);
			var project = await fetchJSON(getJSONURL(id,token));
			dothing("json",project);
			var sb3 = new JSZip();
			dothing("zip",sb3);
			dothing("calculating");
			var assets = [];
			for (var target of project.targets) {
				var targetAssets = target.costumes.concat(target.sounds);
				for (var asset of targetAssets) {
					assets.push(asset);
				}
			}
			var progress = 0;
			dothing("progress",progress,assets.length);
			assets.forEach(async function (asset) {
				try{
					if (asset.md5ext) {
						var content = await fetchArrayBuffer(getAssetURL(asset.md5ext));
						sb3.file(asset.md5ext,content);
					}
					progress += 1;
					dothing("progress",progress,assets.length);
					if (progress == assets.length) {
						dothing("save_json");
						sb3.file("project.json",JSON.stringify(project));
						dothing("finish",sb3);
						accept(sb3);
					}
				}catch(e){
					error = true;
					reject(e);
				}
			});
		} catch (e) {
			error = true;
			reject(e);
		}
	});
}

module.exports = {
	downloadFile: downloadScratchProject
};

//gm2-packager usally calls on project-download.js (not this file) to load sb3 files, i've got lazy and only programmed the part to redirect it to project-downloader.js.

async function loadProject(arrayBuffer) {
	return await JSZip.loadAsync(arrayBuffer);
}

module.exports.loadProject = loadProject;
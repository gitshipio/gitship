"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.k8sCustomApi = exports.k8sAppsApi = exports.k8sCoreApi = void 0;
var k8s = require("@kubernetes/client-node");
var kc = new k8s.KubeConfig();
kc.loadFromDefault();
exports.k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
exports.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
exports.k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);

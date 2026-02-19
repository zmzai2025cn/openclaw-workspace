"use strict";
/**
 * 配置加载
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const dotenv = __importStar(require("dotenv"));
const types_1 = require("./types");
const backup_1 = require("./backup");
const cleanup_1 = require("./cleanup");
const logger_1 = require("./logger");
function loadConfig(envPath) {
    if (envPath) {
        dotenv.config({ path: envPath });
    }
    else {
        dotenv.config();
    }
    const env = process.env;
    return {
        archive: {
            dbPath: env.DB_PATH || types_1.defaultConfig.dbPath,
            bufferSize: parseInt(env.BUFFER_SIZE || String(types_1.defaultConfig.bufferSize), 10),
            flushIntervalMs: parseInt(env.FLUSH_INTERVAL_MS || String(types_1.defaultConfig.flushIntervalMs), 10),
        },
        backup: {
            enabled: env.BACKUP_ENABLED === 'true',
            backupDir: env.BACKUP_DIR || backup_1.defaultBackupConfig.backupDir,
            fullBackupIntervalHours: parseInt(env.BACKUP_INTERVAL_HOURS || String(backup_1.defaultBackupConfig.fullBackupIntervalHours), 10),
            retainCount: parseInt(env.BACKUP_RETAIN_COUNT || String(backup_1.defaultBackupConfig.retainCount), 10),
        },
        cleanup: {
            enabled: env.CLEANUP_ENABLED === 'true',
            retentionDays: parseInt(env.RETENTION_DAYS || String(cleanup_1.defaultCleanupConfig.retentionDays), 10),
            maxDbSizeMB: parseInt(env.MAX_DB_SIZE_MB || String(cleanup_1.defaultCleanupConfig.maxDbSizeMB), 10),
            archiveOldData: env.ARCHIVE_OLD_DATA === 'true',
            archiveDir: env.ARCHIVE_DIR,
        },
        logger: {
            level: env.LOG_LEVEL || logger_1.defaultLoggerConfig.level,
            console: env.LOG_CONSOLE !== 'false',
            file: env.LOG_FILE,
            maxSizeMB: parseInt(env.LOG_MAX_SIZE_MB || String(logger_1.defaultLoggerConfig.maxSizeMB), 10),
            maxFiles: parseInt(env.LOG_MAX_FILES || String(logger_1.defaultLoggerConfig.maxFiles), 10),
        },
        healthPort: parseInt(env.HEALTH_PORT || '8080', 10),
    };
}

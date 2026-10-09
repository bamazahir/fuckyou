import type { Station } from '../core/radio'
import stationsJson from './stations.json'

export const STATIONS = stationsJson.stations as Station[]
export const STATION_EPOCH_MS = Date.parse(stationsJson.epoch)

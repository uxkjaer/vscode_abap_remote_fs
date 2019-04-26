import { isString, isNumber } from "util"
import { Uri } from "vscode"

export const pick = <T, K extends keyof T>(name: K) => (x: T): T[K] => x[name]
export const flat = <T>(a: T[][]): T[] =>
  a.reduce((res, current) => [...res, ...current], [])

export const flatMap = <T1, T2>(
  arr: T1[],
  cb: (c: T1, idx?: number, arrref?: T1[]) => T2[]
) => flat(arr.map(cb))

// given an array of objects returns a map indexed by a property
// only works if the property is an unique key
export function ArrayToMap(name: string) {
  return (arr: any[]): Map<string, any> => {
    return arr.reduce((map, current: any) => {
      map.set(current[name], current)
      return map
    }, new Map())
  }
}

// returns a function that gets the given property from a map
export const selectMap = <T1, K extends keyof T1, T2>(
  map: Map<string, T1>,
  property: K,
  defval: T2
): ((index: string) => T2) => (index: string): T2 => {
  const record = map && map.get(index)
  return ((record && record[property]) || defval) as T2
}

// tslint:disable-next-line: ban-types
const isFn = (f: any): f is Function => {
  return typeof f === "function"
}

export const mapGet = <T1, T2>(
  map: Map<T1, T2>,
  key: T1,
  init: (() => T2) | T2
): T2 => {
  let result = map.get(key)
  if (!result) {
    result = isFn(init) ? init() : init
    map.set(key, result)
  }

  return result
}

export const stringOrder = (s1: any, s2: any) => {
  if (s1 > s2) return 1
  return s2 > s1 ? -1 : 0
}

export const fieldOrder = <T>(fieldName: keyof T, inverse: boolean = false) => (
  a1: T,
  a2: T
) => stringOrder(a1[fieldName], a2[fieldName]) * (inverse ? -1 : 1)

export function parts(whole: any, pattern: RegExp): string[] {
  if (!isString(whole)) return []
  const match = whole.match(pattern)
  return match ? match.slice(1) : []
}

export function toInt(raw: any): number {
  if (isNaN(raw)) return 0
  if (isNumber(raw)) return Math.floor(raw)
  if (!raw && !isString(raw)) return 0
  const n = Number.parseInt(raw, 10)
  if (isNaN(n)) return 0
  return n
}
export const isUnDefined = (x: any) => typeof x === "undefined"
export const isDefined = (x: any) => !isUnDefined(x)
export const uriName = (uri: Uri) => uri.path.split("/").pop() || ""
export const eatPromiseException = async <T>(p: Promise<T>) => {
  try {
    await p
  } catch (error) {
    // ignore
  }
}
export const eatException = (cb: (...args: any[]) => any) => (
  ...args: any[]
) => {
  try {
    return cb(...args)
  } catch (e) {
    return
  }
}
// synchronous. awaiting would defeat the purpose
export const createMutex = () => {
  const m: Map<string, Promise<any>> = new Map()
  return (key: string, cb: any) => {
    const prom = (m.get(key) || Promise.resolve()).then(cb)
    m.set(key, eatPromiseException(prom))
    return prom
  }
}

export const cache = <TK, TP, TAK>(
  creator: (k: TAK) => TP,
  keyTran: (k: TK) => TAK = (x: any) => x
) => {
  const values = new Map<TAK, TP>()
  return {
    get: (k: TK) => {
      const ak = keyTran(k)
      let cur = values.get(ak)
      if (!cur) {
        cur = creator(ak)
        values.set(ak, cur)
      }
      return cur
    },
    get size() {
      return values.size
    },
    *[Symbol.iterator]() {
      const v = values.values()
      let r = v.next()
      while (!r.done) {
        yield r.value
        r = v.next()
      }
    }
  }
}

export const asyncCache = <TK, TP, TAK>(
  creator: (k: TAK) => Promise<TP>,
  keyTran: (k: TK) => TAK = (x: any) => x
) => {
  const values = new Map<TAK, TP>()

  function get(k: TK) {
    return new Promise(async resolve => {
      const ak = keyTran(k)
      let cur = values.get(ak)
      if (!cur) {
        cur = await creator(ak)
        values.set(ak, cur)
      }
      resolve(cur)
    })
  }
  return {
    get,
    getSync: (k: TK) => values.get(keyTran(k)),
    get size() {
      return values.size
    },
    *[Symbol.iterator]() {
      const v = values.values()
      let r = v.next()
      while (!r.done) {
        yield r.value
        r = v.next()
      }
    }
  }
}

export const promiseQueue = <T>(initial: T) => {
  let current = Promise.resolve(initial)
  let last = initial

  return (cb?: (c: T) => Promise<T>, onErr?: (e: Error) => void) => {
    // must guarantee current will always resolve!
    if (cb)
      current = current.then(async cur => {
        try {
          const newres = await cb(cur)
          last = newres
          return newres
        } catch (e) {
          if (onErr) eatException(onErr)(e)
          return last
        }
      })
    return current
  }
}

import {
  CLOTHES_TYPE_LABEL,
  CLOTHES_TYPE_NAMES,
  MAKEUP_TYPE_LABEL,
  MAKEUP_TYPE_NAMES,
  allClothes,
  allClothesGroups,
  allMakeup,
  clothesById,
  clothesByType,
  clothesGroupLabel,
  loadImportedClothes,
  makeupById,
  makeupByType,
  type ClothesTypeName,
  type MakeupTypeName,
} from '../catalog'
import { loadWardrobePersist, saveWardrobePersist } from '../session'
import { modelUrl } from '../assets'
import type { WardrobeApi } from '../preview'
import { PREVIEW_SHOT_LABEL, type PreviewShot } from '../preview'

export type WardrobePanel = {
  setVisible: (v: boolean) => void
  dispose: () => void
}

function iconUrl(row: { icon: string | null; textures?: { map?: string } }): string | null {
  const p = row.icon ?? row.textures?.map
  if (!p) return null
  return modelUrl(...p.split('/'))
}

export function createWardrobePanel(host: HTMLElement, api: WardrobeApi): WardrobePanel {
  const root = document.createElement('aside')
  root.className = 'wardrobe'
  root.style.cssText = `
    display:none; position:absolute; top:16px; right:16px; bottom:16px;
    width:min(620px, 56vw); z-index:20; pointer-events:auto;
    background:rgba(18,12,8,0.94); border:1px solid rgba(232,160,74,0.28);
    border-radius:16px; padding:14px 12px 12px;
    font-family:Segoe UI,PingFang SC,Microsoft YaHei,sans-serif; color:#f3ead8;
    box-shadow:0 18px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(180,70,36,0.12);
    overflow:hidden; flex-direction:column;
  `

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px;'
  header.innerHTML = `<strong style="font-size:17px">衣橱</strong>
    <span style="font-size:11px;color:#b8a894">衣服 / 化妆 / 姿势</span>`
  root.appendChild(header)

  const modeBar = document.createElement('div')
  modeBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;'
  root.appendChild(modeBar)

  const body = document.createElement('div')
  body.style.cssText = 'display:flex;flex:1;min-height:0;gap:10px;'
  root.appendChild(body)

  const modNav = document.createElement('nav')
  modNav.style.cssText = `
    width:148px; flex:0 0 148px; overflow:auto; padding-right:8px;
    border-right:1px solid rgba(180,140,90,0.22);
  `
  body.appendChild(modNav)

  const main = document.createElement('div')
  main.style.cssText = 'flex:1;min-width:0;overflow:auto;display:flex;flex-direction:column;'
  body.appendChild(main)

  const slotBar = document.createElement('div')
  slotBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;'
  main.appendChild(slotBar)

  const shotBar = document.createElement('div')
  shotBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;'
  main.appendChild(shotBar)

  const grid = document.createElement('div')
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px;'
  main.appendChild(grid)

  const dyeRow = document.createElement('div')
  dyeRow.style.cssText =
    'display:none;flex-direction:column;gap:8px;margin-bottom:10px;font-size:12px;'

  const colorCss =
    'width:36px;height:28px;padding:0;border:1px solid rgba(180,140,90,0.35);background:transparent;cursor:pointer;'
  const swatches: Array<[string, string]> = [
    ['原色', '#ffffff'],
    ['黑', '#1a1410'],
    ['深棕', '#3b2414'],
    ['棕', '#6b3d1f'],
    ['金', '#d4a054'],
    ['红', '#8b1e1e'],
    ['粉', '#e8a0b8'],
    ['蓝', '#3d5a80'],
    ['白', '#f2efe8'],
  ]

  const makeColorRow = (label: string, get: () => string, set: (h: string) => void) => {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:8px;'
    const tag = document.createElement('span')
    tag.style.cssText = 'color:#b8a894;min-width:52px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    tag.textContent = label
    tag.title = label
    const input = document.createElement('input')
    input.type = 'color'
    input.value = get()
    input.style.cssText = colorCss
    input.addEventListener('input', () => set(input.value))
    input.addEventListener('keydown', (e) => e.stopPropagation())
    row.append(tag, input)
    for (const [name, hex] of swatches) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.title = name
      btn.style.cssText = `
        width:18px;height:18px;border-radius:999px;cursor:pointer;padding:0;
        border:1px solid rgba(232,238,245,0.45);background:${hex};
      `
      btn.addEventListener('click', () => {
        input.value = hex
        set(hex)
      })
      row.appendChild(btn)
    }
    return { row, input, tag }
  }

  const savedUi = loadWardrobePersist()
  let panel: 'gear' | 'pose' | 'makeup' = 'gear'
  let activeSlot: ClothesTypeName =
    savedUi?.activeSlot && (CLOTHES_TYPE_NAMES as readonly string[]).includes(savedUi.activeSlot)
      ? savedUi.activeSlot
      : 'Skin'
  let activeMod: string | null = savedUi?.activeMod ?? null
  let activeMakeup: MakeupTypeName = 'Lips'
  const rootPick = makeColorRow('发根', () => api.getHairRoot(), (h) => api.setHairRoot(h))
  const tipPick = makeColorRow('发梢', () => api.getHairTip(), (h) => api.setHairTip(h))
  const clothPick = makeColorRow('染色', () => api.getTint(activeSlot), (h) => api.setTint(activeSlot, h))
  const hairHint = document.createElement('span')
  hairHint.style.cssText = 'font-size:11px;color:#7a6a58;'
  hairHint.textContent = '发卡：Root 混发根/发梢，Flow 做丝向高光'
  const clothHint = document.createElement('span')
  clothHint.style.cssText = 'font-size:11px;color:#7a6a58;'
  clothHint.textContent = '衣服 PBR：乘在 BaseColor 上，白=原色'
  const partsHost = document.createElement('div')
  partsHost.style.cssText = 'display:flex;flex-direction:column;gap:6px;width:100%;'
  const partsHint = document.createElement('span')
  partsHint.style.cssText = 'font-size:11px;color:#7a6a58;'
  partsHint.textContent = '按网格材质分块染色。镜片是玻璃；物理布/隐形块不显示。'
  dyeRow.append(rootPick.row, tipPick.row, hairHint, clothPick.row, clothHint, partsHost, partsHint)
  const partRows = new Map<string, ReturnType<typeof makeColorRow>>()
  main.appendChild(dyeRow)

  const worn = document.createElement('div')
  worn.style.cssText = 'font-size:12px;color:#d4c4b0;min-height:18px;margin-bottom:8px;'
  main.appendChild(worn)

  const status = document.createElement('div')
  status.style.cssText = 'font-size:11px;color:#b8a894;line-height:1.45;'
  status.textContent = '衣服走 DataTable 槽。化妆走 Mod_MakeupTable / Mod_EyesTable，不是皮肤。'
  main.appendChild(status)

  const available = new Set<string>()
  const availablePoses = new Set<string>()
  const availableMakeup = new Set<string>()
  let probing = true

  const visibleClothes = (slot: ClothesTypeName) => {
    const rows = clothesByType(slot)
    if (!activeMod) return rows
    return rows.filter((r) => r.group === activeMod)
  }

  const poseInMod = (id: string, url: string, mod: string) =>
    id.startsWith(`${mod}.`) || url.replace(/\\/g, '/').startsWith(`${mod}/`)

  const visiblePoses = () => {
    const rows = api.getPoses()
    if (!activeMod) return rows
    const mod = activeMod
    return rows.filter((r) => poseInMod(r.id, r.url, mod))
  }

  const visibleMakeup = (kind: MakeupTypeName) => {
    const rows = makeupByType(kind)
    if (!activeMod) return rows
    return rows.filter((r) => r.group === activeMod)
  }

  const modBtn = (label: string, opts: { selected: boolean; hint?: string; onClick: () => void }) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = opts.hint ?? label
    btn.textContent = label
    btn.style.cssText = `
      appearance:none; width:100%; text-align:left; cursor:pointer;
      border-radius:8px; padding:6px 8px; margin-bottom:4px;
      font-size:11px; line-height:1.3; color:#f3ead8;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      border:1px solid ${opts.selected ? 'rgba(232,160,74,0.9)' : 'rgba(180,140,90,0.22)'};
      background:${opts.selected ? 'rgba(48,26,12,0.95)' : 'transparent'};
    `
    btn.addEventListener('click', opts.onClick)
    return btn
  }

  const renderMods = () => {
    modNav.innerHTML = ''
    const tag = document.createElement('div')
    tag.style.cssText = 'font-size:10px;color:#7a6a58;margin:0 0 6px 2px;letter-spacing:0.04em;'
    tag.textContent = '模组'
    modNav.appendChild(tag)
    modNav.appendChild(
      modBtn('全部', {
        selected: !activeMod,
        onClick: () => {
          activeMod = null
          saveWardrobePersist({ activeMod: null })
          render()
        },
      }),
    )
    for (const group of allClothesGroups()) {
      const n =
        allClothes().filter((r) => r.group === group).length +
        allMakeup().filter((r) => r.group === group).length +
        api.getPoses().filter((r) => poseInMod(r.id, r.url, group)).length
      const label = clothesGroupLabel(group)
      modNav.appendChild(
        modBtn(`${label}`, {
          selected: activeMod === group,
          hint: `${group} · ${n} 件`,
            onClick: () => {
            activeMod = group
            saveWardrobePersist({ activeMod: group })
            if (visibleClothes(activeSlot).length === 0) {
              const next = CLOTHES_TYPE_NAMES.find((s) => visibleClothes(s).length > 0)
              if (next) activeSlot = next
            }
            if (visibleMakeup(activeMakeup).length === 0) {
              const next = MAKEUP_TYPE_NAMES.find((s) => visibleMakeup(s).length > 0)
              if (next) activeMakeup = next
            }
            render()
          },
        }),
      )
    }
  }

  const tileBtn = (label: string, opts: {
    selected?: boolean
    disabled?: boolean
    icon?: string | null
    onClick: () => void
  }) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.disabled = !!opts.disabled
    btn.style.cssText = `
      appearance:none; border-radius:10px; cursor:${opts.disabled ? 'not-allowed' : 'pointer'};
      border:1px solid ${opts.selected ? 'rgba(232,160,74,0.85)' : 'rgba(180,140,90,0.28)'};
      background:${opts.selected ? 'rgba(48,26,12,0.95)' : 'rgba(28,18,12,0.9)'};
      color:#f3ead8; padding:8px 6px; min-height:72px;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;
      opacity:${opts.disabled ? 0.45 : 1}; font-size:12px;
    `
    if (opts.icon) {
      const img = document.createElement('img')
      img.src = opts.icon
      img.alt = ''
      img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:6px;background:#1a1008;'
      img.addEventListener('error', () => img.remove())
      btn.appendChild(img)
    }
    const cap = document.createElement('span')
    cap.textContent = label
    cap.style.cssText = 'text-align:center;line-height:1.2;'
    btn.appendChild(cap)
    btn.addEventListener('click', opts.onClick)
    return btn
  }

  const renderMode = () => {
    modeBar.innerHTML = ''
    for (const [id, label] of [
      ['gear', '衣服'],
      ['makeup', '化妆'],
      ['pose', '姿势'],
    ] as const) {
      const btn = document.createElement('button')
      btn.type = 'button'
      const on = panel === id
      btn.textContent = label
      btn.style.cssText = `
        appearance:none; border-radius:999px; cursor:pointer; font-size:12px;
        padding:4px 12px;
        border:1px solid ${on ? 'rgba(232,160,74,0.9)' : 'rgba(180,140,90,0.28)'};
        background:${on ? 'rgba(48,26,12,0.95)' : 'rgba(28,18,12,0.7)'};
        color:#f3ead8;
      `
      btn.addEventListener('click', () => {
        panel = id
        if (id === 'pose') {
          api.setShot('full')
          if (activeMod && visiblePoses().length === 0) activeMod = null
        }
        if (id === 'makeup') api.setShot('face')
        render()
      })
      modeBar.appendChild(btn)
    }
  }

  const renderSlots = () => {
    slotBar.innerHTML = ''
    if (panel === 'makeup') {
      const looks = api.getMakeup()
      for (const kind of MAKEUP_TYPE_NAMES) {
        const btn = document.createElement('button')
        btn.type = 'button'
        const on = kind === activeMakeup
        const filled = !!looks[kind]
        const empty = !!activeMod && visibleMakeup(kind).length === 0
        btn.textContent = MAKEUP_TYPE_LABEL[kind]
        btn.style.cssText = `
          appearance:none; border-radius:999px; cursor:pointer; font-size:12px;
          padding:4px 10px;
          border:1px solid ${on ? 'rgba(232,160,74,0.9)' : 'rgba(180,140,90,0.28)'};
          background:${on ? 'rgba(48,26,12,0.95)' : 'rgba(28,18,12,0.7)'};
          color:${filled ? '#e8a04a' : '#f3ead8'};
          opacity:${empty ? 0.4 : 1};
        `
        btn.addEventListener('click', () => {
          activeMakeup = kind
          if (
            kind === 'Eye' ||
            kind === 'Eyelashes' ||
            kind === 'Lips' ||
            kind === 'Eyebrow' ||
            kind === 'Eyeshadow' ||
            kind === 'Eyeliner' ||
            kind === 'Cheeks' ||
            kind === 'Nose'
          ) {
            api.setShot('face')
          }
          render()
        })
        slotBar.appendChild(btn)
      }
      return
    }
    const loadout = api.getLoadout()
    for (const slot of CLOTHES_TYPE_NAMES) {
      const btn = document.createElement('button')
      btn.type = 'button'
      const on = slot === activeSlot
      const filled = !!loadout[slot]
      const empty = !!activeMod && visibleClothes(slot).length === 0
      btn.textContent = CLOTHES_TYPE_LABEL[slot]
      btn.style.cssText = `
        appearance:none; border-radius:999px; cursor:pointer; font-size:12px;
        padding:4px 10px;
        border:1px solid ${on ? 'rgba(232,160,74,0.9)' : 'rgba(180,140,90,0.28)'};
        background:${on ? 'rgba(48,26,12,0.95)' : 'rgba(28,18,12,0.7)'};
        color:${filled ? '#e8a04a' : '#f3ead8'};
        opacity:${empty ? 0.4 : 1};
      `
      btn.addEventListener('click', () => {
        activeSlot = slot
        saveWardrobePersist({ activeSlot: slot })
        api.focusSlot(slot)
        render()
      })
      slotBar.appendChild(btn)
    }
  }

  const renderShots = () => {
    shotBar.innerHTML = ''
    const cur = api.getShot()
    for (const id of ['full', 'bust', 'face'] as const satisfies readonly PreviewShot[]) {
      const btn = document.createElement('button')
      btn.type = 'button'
      const on = cur === id
      btn.textContent = PREVIEW_SHOT_LABEL[id]
      btn.style.cssText = `
        appearance:none; border-radius:999px; cursor:pointer; font-size:11px;
        padding:3px 9px;
        border:1px solid ${on ? 'rgba(232,160,74,0.85)' : 'rgba(180,140,90,0.28)'};
        background:${on ? 'rgba(48,26,12,0.95)' : 'rgba(28,18,12,0.7)'};
        color:#f3ead8;
      `
      btn.addEventListener('click', () => api.setShot(id))
      shotBar.appendChild(btn)
    }
  }

  const renderGrid = () => {
    grid.innerHTML = ''
    if (panel === 'pose') {
      const poseId = api.getPoseId()
      grid.appendChild(
        tileBtn('卸下', {
          selected: !poseId,
          disabled: probing,
          onClick: () => void api.setPose(null),
        }),
      )
      for (const row of visiblePoses()) {
        const ready = availablePoses.has(row.id)
        const selected = poseId === row.id
        grid.appendChild(
          tileBtn(row.caption, {
            selected,
            disabled: probing ? true : !ready,
            icon: row.icon ? modelUrl(...row.icon.split('/')) : null,
            onClick: () => {
              if (!ready) return
              if (selected) void api.setPose(null)
              else void api.setPose(row.id)
            },
          }),
        )
        if (!ready) {
          const last = grid.lastElementChild as HTMLButtonElement | null
          if (last) last.title = '还没有动画文件'
        }
      }
      if (!probing && visiblePoses().length === 0) {
        grid.appendChild(
          tileBtn('待导入动画', {
            disabled: true,
            onClick: () => undefined,
          }),
        )
      }
      return
    }
    if (panel === 'makeup') {
      const looks = api.getMakeup()
      const equippedId = looks[activeMakeup] ?? null
      const rows = visibleMakeup(activeMakeup)
      grid.appendChild(
        tileBtn('卸下', {
          selected: !equippedId,
          disabled: probing,
          onClick: () => void api.equipMakeup(null, activeMakeup),
        }),
      )
      for (const row of rows) {
        const ready = availableMakeup.has(row.id)
        const selected = equippedId === row.id
        grid.appendChild(
          tileBtn(row.caption, {
            selected,
            disabled: probing ? true : !ready,
            icon: iconUrl(row),
            onClick: () => {
              if (!ready) return
              if (selected) void api.equipMakeup(null, activeMakeup)
              else void api.equipMakeup(row.id, activeMakeup)
            },
          }),
        )
      }
      if (!probing && rows.length === 0) {
        grid.appendChild(
          tileBtn('待导入化妆表', {
            disabled: true,
            onClick: () => undefined,
          }),
        )
      }
      return
    }
    const rows = visibleClothes(activeSlot)
    const loadout = api.getLoadout()
    const equippedId = loadout[activeSlot] ?? null
    grid.appendChild(
      tileBtn('卸下', {
        selected: !equippedId,
        disabled: probing,
        onClick: () => void api.equip(null, activeSlot),
      }),
    )
    for (const row of rows) {
      const ready = available.has(row.id)
      const selected = equippedId === row.id
      grid.appendChild(
        tileBtn(row.caption, {
          selected,
          disabled: probing ? true : !ready,
          icon: iconUrl(row),
          onClick: () => {
            if (!ready) return
            if (selected) void api.equip(null, activeSlot)
            else void api.equip(row.id, activeSlot)
          },
        }),
      )
    }
    if (!probing && rows.length === 0) {
      grid.appendChild(
        tileBtn('待导入素材', {
          disabled: true,
          onClick: () => undefined,
        }),
      )
    }
  }

  const renderWorn = () => {
    const loadout = api.getLoadout()
    const bits: string[] = []
    for (const slot of CLOTHES_TYPE_NAMES) {
      const id = loadout[slot]
      if (!id) continue
      const row = clothesById(id)
      bits.push(`${CLOTHES_TYPE_LABEL[slot]} ${row?.caption ?? id}`)
    }
    const looks = api.getMakeup()
    for (const kind of MAKEUP_TYPE_NAMES) {
      const id = looks[kind]
      if (!id) continue
      const row = makeupById(id)
      bits.push(`${MAKEUP_TYPE_LABEL[kind]} ${row?.caption ?? id}`)
    }
    worn.textContent = bits.length ? `已穿：${bits.join(' · ')}` : '已穿：空'
    const pose = api.getPoseId()
    if (pose) {
      const row = api.getPoses().find((r) => r.id === pose)
      worn.textContent += ` · 姿势 ${row?.caption ?? pose}`
    }
    const err = api.getError()
    if (probing) {
      status.textContent = '正在探测资源… 表里声明的化妆看贴图，衣服看网格。'
    } else if (err) {
      status.style.color = '#fb7185'
      status.textContent = err
    } else {
      status.style.color = '#b8a894'
      const n = available.size
      const p = availablePoses.size
      const m = availableMakeup.size
      status.textContent =
        n + p + m > 0
          ? `${n} 件衣服 · ${m} 件化妆 · ${p} 条姿势。化妆读 Mod_MakeupTable / Mod_EyesTable。inbox 丢 pak 后 pnpm import:tka。`
          : '还没有可预览的衣服或化妆。丢 zip/pak 到 inbox，跑 pnpm import:tka。'
    }
  }

  const render = () => {
    const sub = header.querySelector('span')
    if (sub) sub.textContent = activeMod ? clothesGroupLabel(activeMod) : '全部模组'
    renderMode()
    renderMods()
    renderSlots()
    slotBar.style.display = panel === 'pose' ? 'none' : 'flex'
    renderShots()
    renderGrid()
    renderWorn()
    dyeRow.style.display = panel === 'gear' && activeSlot !== 'Skin' ? 'flex' : 'none'
    const hairOn = panel === 'gear' && activeSlot === 'Hair'
    const dyeParts = hairOn || panel !== 'gear' || activeSlot === 'Skin' ? [] : api.listSlotParts(activeSlot)
    const multi = dyeParts.length > 1
    rootPick.row.style.display = hairOn ? 'flex' : 'none'
    tipPick.row.style.display = hairOn ? 'flex' : 'none'
    hairHint.style.display = hairOn ? 'block' : 'none'
    clothPick.row.style.display = hairOn || multi || dyeParts.length === 0 ? 'none' : 'flex'
    clothHint.style.display = hairOn || multi || dyeParts.length === 0 ? 'none' : 'block'
    partsHost.style.display = multi ? 'flex' : 'none'
    partsHint.style.display = multi ? 'block' : 'none'
    const keep = new Set(multi ? dyeParts.map((p) => p.id) : [])
    for (const [id, rec] of [...partRows]) {
      if (keep.has(id)) continue
      rec.row.remove()
      partRows.delete(id)
    }
    if (multi) {
      for (const p of dyeParts) {
        let rec = partRows.get(p.id)
        if (!rec) {
          rec = makeColorRow(p.label, () => api.getPartTint(activeSlot, p.id), (h) =>
            api.setPartTint(activeSlot, p.id, h),
          )
          partRows.set(p.id, rec)
          partsHost.appendChild(rec.row)
        } else {
          rec.tag.textContent = p.label
          rec.tag.title = p.label
        }
        if (document.activeElement !== rec.input) rec.input.value = api.getPartTint(activeSlot, p.id)
      }
    }
    if (document.activeElement !== rootPick.input) rootPick.input.value = api.getHairRoot()
    if (document.activeElement !== tipPick.input) tipPick.input.value = api.getHairTip()
    if (document.activeElement !== clothPick.input) clothPick.input.value = api.getTint(activeSlot)
  }

  const unsub = api.subscribe(render)

  void (async () => {
    await loadImportedClothes()
    if (activeMod && !allClothesGroups().includes(activeMod)) activeMod = null
    const checks = allClothes().map(async (row) => {
      if (!row.mesh) return
        const url = modelUrl(...row.mesh.split('/'))
        const isGlb = /\.(glb|gltf)$/i.test(url)
        try {
          const r = await fetch(url, { method: 'HEAD' })
          const ct = r.headers.get('content-type') ?? ''
          // Vite SPA fallback serves index.html (200) for missing public files.
          if (
            r.ok &&
            !ct.includes('html') &&
            (isGlb || ct.includes('gltf') || ct.includes('model') || ct.includes('octet'))
          ) {
            available.add(row.id)
          }
      } catch {
        /* missing */
      }
    })
    await Promise.all(checks)
    const poseChecks = api.getPoses().map(async (row) => {
      const url = modelUrl(...row.url.split('/'))
      const isGlb = /\.(glb|gltf)$/i.test(url)
      try {
        const r = await fetch(url, { method: 'HEAD' })
        const ct = r.headers.get('content-type') ?? ''
        if (
          r.ok &&
          !ct.includes('html') &&
          (isGlb || ct.includes('gltf') || ct.includes('model') || ct.includes('octet'))
        ) {
          availablePoses.add(row.id)
        }
      } catch {
        /* missing */
      }
    })
    await Promise.all(poseChecks)
    const makeupChecks = allMakeup().map(async (row) => {
      const rel = row.textures?.map ?? row.icon
      if (!rel) {
        availableMakeup.add(row.id)
        return
      }
      if (/\.(png|jpe?g|webp)$/i.test(rel)) {
        availableMakeup.add(row.id)
        return
      }
      const url = modelUrl(...rel.split('/'))
      try {
        const r = await fetch(url, { method: 'HEAD' })
        const ct = r.headers.get('content-type') ?? ''
        if (r.ok && !ct.includes('html')) availableMakeup.add(row.id)
      } catch {
        /* missing */
      }
    })
    await Promise.all(makeupChecks)
    probing = false
    await api.hydrate().catch(() => undefined)
    render()
  })()

  render()
  host.appendChild(root)

  return {
    setVisible: (v) => {
      root.style.display = v ? 'flex' : 'none'
    },
    dispose: () => {
      unsub()
      root.remove()
    },
  }
}

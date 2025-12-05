import React, { useEffect, useRef } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  DynamicTexture,
  TransformNode
} from '@babylonjs/core'

export const PennsylvaniaCallBanner: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0, 0, 0, 0) // Transparent background to let page bg show, or dark

    // Camera setup
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 15, Vector3.Zero(), scene)
    camera.attachControl(canvasRef.current, true)
    camera.wheelPrecision = 50
    camera.minZ = 0.1

    // Lighting
    const hemiLight = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
    hemiLight.intensity = 0.8
    
    const dirLight = new DirectionalLight('dir', new Vector3(-1, -2, -2), scene)
    dirLight.position = new Vector3(20, 40, 20)
    dirLight.intensity = 0.7

    // --- Materials ---
    const darkBlueMat = new StandardMaterial('darkBlue', scene)
    darkBlueMat.diffuseColor = Color3.FromHexString('#1e1b4b')
    darkBlueMat.emissiveColor = new Color3(0.1, 0.1, 0.2) // Slight glow
    
    const headerBlueMat = new StandardMaterial('headerBlue', scene)
    headerBlueMat.diffuseColor = Color3.FromHexString('#2e2a85')
    headerBlueMat.emissiveColor = new Color3(0.1, 0.1, 0.3)

    const pinkMat = new StandardMaterial('pink', scene)
    pinkMat.diffuseColor = Color3.FromHexString('#ec4899')
    pinkMat.emissiveColor = new Color3(0.2, 0.05, 0.1)

    const whiteMat = new StandardMaterial('white', scene)
    whiteMat.diffuseColor = Color3.White()
    whiteMat.emissiveColor = new Color3(0.1, 0.1, 0.1)

    const redMat = new StandardMaterial('red', scene)
    redMat.diffuseColor = Color3.FromHexString('#ef4444')
    redMat.emissiveColor = new Color3(0.2, 0.05, 0.05)

    const blueMat = new StandardMaterial('blue', scene)
    blueMat.diffuseColor = Color3.FromHexString('#3b82f6')
    blueMat.emissiveColor = new Color3(0.05, 0.1, 0.2)

    const yellowMat = new StandardMaterial('yellow', scene)
    yellowMat.diffuseColor = Color3.FromHexString('#facc15')
    yellowMat.emissiveColor = new Color3(0.3, 0.3, 0)
    
    const footerMat = new StandardMaterial('footer', scene)
    footerMat.diffuseColor = Color3.FromHexString('#17153b')
    footerMat.emissiveColor = new Color3(0.1, 0.1, 0.2)

    // --- Helper: Create Text Plane ---
    const createTextPlane = (
      text: string, 
      options: { 
        width: number, 
        height: number, 
        color: string, 
        fontSize?: number, 
        align?: 'left'|'center'|'right', 
        bold?: boolean,
        fontFamily?: string
      }
    ) => {
      const planeWidth = options.width
      const planeHeight = options.height
      const textureWidth = 2048 // Increased resolution
      const textureHeight = Math.ceil(textureWidth * (planeHeight / planeWidth))
      
      const plane = MeshBuilder.CreatePlane('textPlane', { width: planeWidth, height: planeHeight }, scene)
      const dt = new DynamicTexture('dynamicTexture', { width: textureWidth, height: textureHeight }, scene, true)
      dt.hasAlpha = true
      
      const ctx = dt.getContext() as CanvasRenderingContext2D
      // Adjusted scale factor for 2048 width (base 512 -> 4x)
      const fontSize = options.fontSize ? (options.fontSize * (textureWidth / 512)) : (60 * (textureWidth / 512))
      const font = `${options.bold ? 'bold' : ''} ${fontSize}px ${options.fontFamily || 'Arial, sans-serif'}`
      ctx.font = font
      ctx.fillStyle = options.color
      ctx.textBaseline = 'middle'
      
      const textWidth = ctx.measureText(text).width
      let x = 0
      if (options.align === 'center') x = (textureWidth - textWidth) / 2
      else if (options.align === 'right') x = textureWidth - textWidth - 80 // Increased padding for higher res
      else x = 80 // Increased padding

      ctx.fillText(text, x, textureHeight / 2)
      dt.update()
      
      const mat = new StandardMaterial('textMat', scene)
      mat.diffuseTexture = dt
      mat.opacityTexture = dt
      mat.emissiveColor = Color3.White()
      mat.disableLighting = true
      mat.backFaceCulling = false
      plane.material = mat
      
      return plane
    }

    // --- Build Banner Geometry ---
    const root = new TransformNode('bannerRoot', scene)
    
    // 1. Header (State Name)
    const headerBox = MeshBuilder.CreateBox('headerBox', { width: 10, height: 1.5, depth: 0.2 }, scene)
    headerBox.material = headerBlueMat
    headerBox.position.y = 2.25
    headerBox.parent = root
    
    // Increased font size slightly for better visibility
    const headerText = createTextPlane('PENNSYLVANIA', { width: 9, height: 1.2, color: 'white', fontSize: 50, bold: true, align: 'left', fontFamily: 'Inter' })
    headerText.parent = headerBox
    headerText.position.z = -0.11
    headerText.position.x = 0.2 // Slight offset

    // 2. Electoral Bar
    const electoralBox = MeshBuilder.CreateBox('electoralBox', { width: 10, height: 0.5, depth: 0.2 }, scene)
    electoralBox.material = pinkMat
    electoralBox.position.y = 1.25
    electoralBox.parent = root
    
    const electoralText = createTextPlane('19 ELECTORAL VOTES', { width: 9.5, height: 0.4, color: 'white', fontSize: 30, bold: true, align: 'left', fontFamily: 'Inter' })
    electoralText.parent = electoralBox
    electoralText.position.z = -0.11
    electoralText.position.x = 0.2

    // 3. Candidates
    const createCandidateRow = (yPos: number, name: string, votes: string, pct: string, partyMat: StandardMaterial, isWinner: boolean) => {
        const rowBox = MeshBuilder.CreateBox('rowBox', { width: 10, height: 1.2, depth: 0.2 }, scene)
        rowBox.material = whiteMat
        rowBox.position.y = yPos
        rowBox.parent = root

        // Party Bar
        const partyBar = MeshBuilder.CreateBox('partyBar', { width: 0.3, height: 1.2, depth: 0.22 }, scene)
        partyBar.material = partyMat
        partyBar.parent = rowBox
        partyBar.position.x = -4.85
        
        // Name - Adjusted position and width to avoid overlap with checkmark
        const nameText = createTextPlane(name, { width: 5.5, height: 1, color: '#0f172a', fontSize: 40, bold: true, align: 'left', fontFamily: 'Inter' })
        nameText.parent = rowBox
        nameText.position.x = -1.0 // Moved right (was -1.5)
        nameText.position.z = -0.11
        
        // Votes
        const votesText = createTextPlane(votes, { width: 3, height: 0.5, color: '#0f172a', fontSize: 35, bold: true, align: 'right', fontFamily: 'Inter' })
        votesText.parent = rowBox
        votesText.position.x = 3.2
        votesText.position.y = 0.2
        votesText.position.z = -0.11
        
        // Percent
        const pctText = createTextPlane(pct, { width: 3, height: 0.5, color: '#0f172a', fontSize: 30, bold: false, align: 'right', fontFamily: 'Inter' })
        pctText.parent = rowBox
        pctText.position.x = 3.2
        pctText.position.y = -0.2
        pctText.position.z = -0.11

        // Winner Check
        if (isWinner) {
            const checkBg = MeshBuilder.CreateDisc('checkBg', { radius: 0.35, tessellation: 32 }, scene)
            checkBg.material = yellowMat
            checkBg.parent = rowBox
            checkBg.position.x = -4.4 // Moved left (was -4.2)
            checkBg.position.z = -0.15 
            
            const checkText = createTextPlane('✓', { width: 0.6, height: 0.6, color: 'black', fontSize: 250, bold: true, align: 'center' })
            checkText.parent = rowBox
            checkText.position.x = -4.4 // Moved left (was -4.2)
            checkText.position.z = -0.16 
        }
    }

    createCandidateRow(0.35, 'DONALD TRUMP', '3,543,308', '50.37%', redMat, true)
    createCandidateRow(-0.95, 'KAMALA HARRIS', '3,423,042', '48.66%', blueMat, false)

    // 4. Footer
    const footerBox = MeshBuilder.CreateBox('footerBox', { width: 10, height: 0.8, depth: 0.2 }, scene)
    footerBox.material = footerMat
    footerBox.position.y = -2.0
    footerBox.parent = root
    
    // Reduced font size to 20 to prevent cutoff
    const footerText = createTextPlane('100% REPORTED   |   TOTAL: 7,034,206   |   MARGIN: 1.71%', { width: 9.5, height: 0.6, color: 'white', fontSize: 20, bold: true, align: 'center', fontFamily: 'Inter' })
    footerText.parent = footerBox
    footerText.position.z = -0.11

    // Animation Loop
    let t = 0
    scene.registerBeforeRender(() => {
        t += 0.005
        // Gentle floating animation
        root.rotation.y = Math.sin(t) * 0.05
        root.rotation.x = Math.sin(t * 0.8) * 0.02
    })

    engine.runRenderLoop(() => {
      scene.render()
    })

    const handleResize = () => engine.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      engine.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="h-[600px] w-full outline-none" />
}


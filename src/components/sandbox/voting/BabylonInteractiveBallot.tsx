import React, { useEffect, useRef, useState } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  Color3,
  Color4,
  PointerEventTypes,
  Animation,
  EasingFunction,
  CubicEase,
  Mesh
} from '@babylonjs/core'

interface Candidate {
  id: string
  name: string
  party: string
  runningMate?: string
}

const CANDIDATES: Candidate[] = [
  { id: 'gop', name: 'Donald J. Trump', runningMate: 'Michael R. Pence', party: 'Republican' },
  { id: 'dem', name: 'Hillary Clinton', runningMate: 'Tim Kaine', party: 'Democratic' },
  { id: 'const', name: 'Darrell L. Castle', runningMate: 'Scott N. Bradley', party: 'Constitution' },
  { id: 'lib', name: 'Gary Johnson', runningMate: 'Bill Weld', party: 'Libertarian' },
  { id: 'green', name: 'Jill Stein', runningMate: 'Ajamu Baraka', party: 'Wisconsin Green' },
]

interface Props {
    onSwitchBallotType?: () => void
}

export const BabylonInteractiveBallot: React.FC<Props> = ({ onSwitchBallotType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [writeInText, setWriteInText] = useState<string>('')
  const [isWriteInActive, setIsWriteInActive] = useState<boolean>(false)
  const sceneRef = useRef<Scene | null>(null)
  const textureRef = useRef<DynamicTexture | null>(null)
  const ballotMeshRef = useRef<Mesh | null>(null)

  // Draw the ballot texture based on current state
  const drawBallot = (texture: DynamicTexture, selected: string | null, writeInText: string, isWriteInActive: boolean) => {
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
    const width = 1024
    const height = 2048 // Higher resolution

    // --- Background ---
    ctx.fillStyle = '#fdfbf7' // Off-white paper
    ctx.fillRect(0, 0, width, height)
    
    // Subtle security pattern
    ctx.save()
    ctx.strokeStyle = '#f0eee9'
    ctx.lineWidth = 1
    for(let i=0; i<width; i+=20) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, height)
        ctx.stroke()
    }
    ctx.restore()

    // --- Header ---
    // Black bar at top
    ctx.fillStyle = '#000000'
    ctx.fillRect(40, 40, width - 80, 120)
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 44px "Times New Roman", serif'
    ;(ctx as any).textAlign = 'center'
    ctx.fillText('OFFICIAL GENERAL ELECTION BALLOT', width/2, 100)
    
    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.fillText('STATE OF WISCONSIN • NOVEMBER 8, 2016', width/2, 145)

    // Instructions Box
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.strokeRect(40, 180, 320, 280)
    
    ctx.fillStyle = '#000000'
    ;(ctx as any).textAlign = 'left'
    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillText('INSTRUCTIONS TO VOTERS', 50, 215)
    
    ctx.font = '18px Arial, sans-serif'
    const instructions = [
        "To vote for a candidate, fill in the oval",
        "next to the name like this:",
        "", // Space for oval
        "To vote for a write-in candidate, write",
        "the name on the line provided and fill",
        "in the oval next to the name."
    ]
    instructions.forEach((line, i) => {
        ctx.fillText(line, 50, 250 + (i * 28))
    })
    
    // Example Oval (Placed visually after "like this:")
    ctx.beginPath()
    ctx.ellipse(300, 272, 20, 14, 0, 0, 2 * Math.PI)
    ctx.fillStyle = '#000000'
    ctx.fill()
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.stroke()

    // --- Contest Header ---
    const col1X = 400
    const colWidth = width - 440
    
    ctx.fillStyle = '#000000'
    ctx.fillRect(col1X, 180, colWidth, 50)
    
    ctx.fillStyle = '#FFFFFF'
    ;(ctx as any).textAlign = 'left'
    ctx.font = 'bold 32px Arial, sans-serif'
    ctx.fillText('PRESIDENT OF THE UNITED STATES', col1X + 20, 215)
    
    ctx.fillStyle = '#000000'
    ctx.font = 'italic 24px "Times New Roman", serif'
    ctx.fillText('Vote for One', col1X + 20, 260)

    // --- Candidates ---
    const startY = 300
    const rowHeight = 160

    CANDIDATES.forEach((c, index) => {
      const y = startY + (index * rowHeight)
      
      // Separator
      ctx.beginPath()
      ctx.moveTo(col1X, y)
      ctx.lineTo(col1X + colWidth, y)
      ctx.strokeStyle = '#aaaaaa'
      ctx.lineWidth = 1
      ctx.stroke()
      
      // Oval
      const ovalX = col1X + 40
      const ovalY = y + 50
      
      ctx.beginPath()
      ctx.ellipse(ovalX, ovalY, 25, 16, 0, 0, 2 * Math.PI)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3
      ctx.stroke()

      // Fill if selected
      if (selected === c.id) {
        ctx.fillStyle = '#000000'
        ctx.fill()
        
        // Imperfect marker fill
        ctx.beginPath()
        ctx.ellipse(ovalX + 2, ovalY + 1, 22, 14, 0.1, 0, 2 * Math.PI)
        ctx.fillStyle = '#222222'
        ctx.fill()
      }

      // Text
      ctx.fillStyle = '#000000'
      ;(ctx as any).textAlign = 'left'
      
      // Name
      ctx.font = 'bold 36px Arial, sans-serif'
      ctx.fillText(c.name, ovalX + 50, y + 45)
      
      // Running Mate
      if (c.runningMate) {
        ctx.font = '28px Arial, sans-serif'
        ctx.fillText(`/ ${c.runningMate}`, ovalX + 50, y + 80)
      }
      
      // Party
      ctx.font = 'italic 24px "Times New Roman", serif'
      ctx.fillText(c.party, ovalX + 50, y + 110)
    })

    // Write-in section
    const writeInY = startY + (CANDIDATES.length * rowHeight)
    
    // Separator
    ctx.beginPath()
    ctx.moveTo(col1X, writeInY)
    ctx.lineTo(col1X + colWidth, writeInY)
    ctx.strokeStyle = '#aaaaaa'
    ctx.lineWidth = 1
    ctx.stroke()

    const wOvalX = col1X + 40
    const wOvalY = writeInY + 50

    ctx.beginPath()
    ctx.ellipse(wOvalX, wOvalY, 25, 16, 0, 0, 2 * Math.PI)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.stroke()
    
    ctx.fillStyle = '#000000'
    ctx.font = '28px Arial, sans-serif'
    ctx.fillText('write-in:', wOvalX + 50, wOvalY + 10)
    
    // Write-in line
    ctx.beginPath()
    ctx.moveTo(wOvalX + 50, wOvalY + 50)
    ctx.lineTo(wOvalX + 400, wOvalY + 50)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.stroke()

    // Render typed text
    if (writeInText || isWriteInActive) {
        ctx.font = 'bold 32px "Courier New", monospace'
        ctx.fillStyle = '#000000'
        ctx.fillText(writeInText + (isWriteInActive ? '|' : ''), wOvalX + 60, wOvalY + 45)
    }
    
    // Bottom Bar
    ctx.fillStyle = '#000000'
    ctx.fillRect(40, height - 60, width - 80, 20)

    texture.update()
  }

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true)
    const scene = new Scene(engine)
    sceneRef.current = scene
    scene.clearColor = new Color4(0.2, 0.2, 0.25, 1) // Darker, professional background

    // Camera
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 20, Vector3.Zero(), scene)
    camera.attachControl(canvasRef.current, true)
    camera.lowerRadiusLimit = 10
    camera.upperRadiusLimit = 30
    camera.wheelPrecision = 50

    // Lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    light.intensity = 0.8
    
    const dirLight = new HemisphericLight('dirLight', new Vector3(1, 1, -0.5), scene)
    dirLight.intensity = 0.5

    // Desk Surface
    const desk = MeshBuilder.CreateGround('desk', { width: 50, height: 50 }, scene)
    const deskMat = new StandardMaterial('deskMat', scene)
    deskMat.diffuseColor = new Color3(0.4, 0.25, 0.15) // Wood color
    deskMat.specularColor = new Color3(0.1, 0.1, 0.1)
    desk.material = deskMat
    desk.position.y = -0.1

    // Ballot Mesh
    // Aspect ratio 1024/2048 = 0.5
    const ballotWidth = 8
    const ballotHeight = 16
    const ballot = MeshBuilder.CreateBox('ballot', { 
        width: ballotWidth, 
        height: ballotHeight, 
        depth: 0.02 // Very thin paper
    }, scene)
    ballotMeshRef.current = ballot
    
    // Lay flat on desk
    ballot.rotation.x = Math.PI / 2
    ballot.position.y = 0.05

    // Material
    const mat = new StandardMaterial('ballotMat', scene)
    const texture = new DynamicTexture('ballotTexture', { width: 1024, height: 2048 }, scene, false)
    textureRef.current = texture
    
    mat.diffuseTexture = texture
    mat.specularColor = new Color3(0.05, 0.05, 0.05) // Matte paper
    mat.roughness = 0.9
    ballot.material = mat

    // Switch Button
    const switchBtn = MeshBuilder.CreateCylinder('switchBtn', { diameter: 2, height: 0.5 }, scene)
    switchBtn.position = new Vector3(8, 0.25, 2)
    const btnMat = new StandardMaterial('btnMat', scene)
    btnMat.diffuseColor = Color3.Purple()
    switchBtn.material = btnMat

    // Button Label (Plane with text)
    const labelPlane = MeshBuilder.CreatePlane('labelPlane', { width: 4, height: 2 }, scene)
    labelPlane.position = new Vector3(8, 1.5, 2)
    labelPlane.rotation.x = Math.PI / 4 // Tilt towards camera
    
    const labelTexture = new DynamicTexture('labelTexture', { width: 256, height: 128 }, scene, true)
    const labelCtx = labelTexture.getContext()
    labelCtx.fillStyle = 'transparent'
    labelCtx.fillRect(0, 0, 256, 128)
    labelCtx.font = 'bold 40px Arial'
    labelCtx.fillStyle = 'white'
    ;(labelCtx as any).textAlign = 'center'
    labelCtx.fillText('Switch to', 128, 50)
    labelCtx.fillText('RCV Ballot', 128, 90)
    labelTexture.update()
    
    const labelMat = new StandardMaterial('labelMat', scene)
    labelMat.diffuseTexture = labelTexture
    labelMat.specularColor = Color3.Black()
    labelMat.emissiveColor = Color3.White()
    labelMat.backFaceCulling = false
    labelPlane.material = labelMat

    // Initial Draw
    drawBallot(texture, null, '', false)

    // Interaction
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.pickInfo?.hit) {
            if (pointerInfo.pickInfo.pickedMesh === switchBtn) {
                // Animate button press
                const anim = new Animation("press", "position.y", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
                const keys = [
                    { frame: 0, value: 0.25 },
                    { frame: 10, value: 0.1 },
                    { frame: 20, value: 0.25 }
                ]
                anim.setKeys(keys)
                scene.beginDirectAnimation(switchBtn, [anim], 0, 20, false, 1, () => {
                    if (onSwitchBallotType) onSwitchBallotType()
                })
            }
            else if (pointerInfo.pickInfo.pickedMesh === ballot) {
                const uv = pointerInfo.pickInfo.getTextureCoordinates()
          if (uv) {
            // UV.y is 0 at bottom, 1 at top. Canvas is 0 at top.
            const canvasY = (1 - uv.y) * 2048
            const canvasX = uv.x * 1024
            
            // Check column bounds (approximate based on drawing code)
            if (canvasX > 400) {
                const startY = 300
                const rowHeight = 160
                
                // Offset slightly to align with click areas
                const relativeY = canvasY - startY
                
                if (relativeY >= 0) {
                    const index = Math.floor(relativeY / rowHeight)
                    if (index >= 0 && index < CANDIDATES.length) {
                        const candidate = CANDIDATES[index]
                        setSelectedId(prev => prev === candidate.id ? null : candidate.id)
                        setIsWriteInActive(false)
                    } else if (index === CANDIDATES.length) {
                        // Clicked write-in area
                        setSelectedId('write-in')
                        setIsWriteInActive(true)
                    }
                }
            }
          }
        }
      }
      }
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

  // Redraw when selection changes
  useEffect(() => {
    if (textureRef.current) {
        drawBallot(textureRef.current, selectedId, writeInText, isWriteInActive)
    }
  }, [selectedId, writeInText, isWriteInActive])

  // Handle keyboard input for write-in
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isWriteInActive) return

        if (e.key === 'Backspace') {
            setWriteInText(prev => prev.slice(0, -1))
        } else if (e.key.length === 1) {
            // Prevent excessive length
            if (writeInText.length < 25) {
                 setWriteInText(prev => prev + e.key)
            }
        }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWriteInActive, writeInText])

  const castVote = () => {
    if (!ballotMeshRef.current || !sceneRef.current) return
    
    // Animation: Slide forward and drop
    const frameRate = 60
    const zSlide = new Animation("zSlide", "position.z", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    const yDrop = new Animation("yDrop", "position.y", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    const xRot = new Animation("xRot", "rotation.x", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)

    const keyFramesZ = [] 
    keyFramesZ.push({ frame: 0, value: 0 })
    keyFramesZ.push({ frame: 60, value: 15 }) // Slide forward

    const keyFramesY = []
    keyFramesY.push({ frame: 0, value: 0.05 })
    keyFramesY.push({ frame: 30, value: 0.05 })
    keyFramesY.push({ frame: 60, value: -5 }) // Drop down

    const keyFramesRot = []
    keyFramesRot.push({ frame: 0, value: Math.PI / 2 })
    keyFramesRot.push({ frame: 60, value: Math.PI / 2 + Math.PI / 4 }) // Tilt down

    zSlide.setKeys(keyFramesZ)
    yDrop.setKeys(keyFramesY)
    xRot.setKeys(keyFramesRot)

    const easing = new CubicEase()
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN)
    zSlide.setEasingFunction(easing)

    sceneRef.current.beginDirectAnimation(ballotMeshRef.current, [zSlide, yDrop, xRot], 0, 60, false, 1, () => {
        // Reset after animation
        setTimeout(() => {
            if (ballotMeshRef.current) {
                ballotMeshRef.current.position.y = 0.05
                ballotMeshRef.current.position.z = 0
                ballotMeshRef.current.rotation.x = Math.PI / 2
                setSelectedId(null)
                setWriteInText('')
                setIsWriteInActive(false)
            }
        }, 1000)
    })
  }

  return (
    <div className="relative w-full h-full">
        <canvas ref={canvasRef} className="w-full h-full outline-none" />
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <button 
                onClick={castVote}
                disabled={!selectedId}
                className={`px-8 py-3 rounded-full font-bold text-xl shadow-lg transition-all ${
                    selectedId 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
                Cast Vote
            </button>
        </div>
        <div className="absolute top-4 left-4 bg-white/80 p-4 rounded shadow backdrop-blur">
            <h2 className="font-bold text-lg">Interactive Ballot Prototype</h2>
            <p className="text-sm text-gray-600">Click an oval to select a candidate.</p>
            <p className="text-sm text-gray-600">Click "Cast Vote" to submit.</p>
        </div>
    </div>
  )
}

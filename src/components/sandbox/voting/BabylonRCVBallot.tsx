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
}

const CANDIDATES: Candidate[] = [
  { id: 'c1', name: 'Alice Adams', party: 'Gold Party' },
  { id: 'c2', name: 'Bob Brown', party: 'Silver Party' },
  { id: 'c3', name: 'Charlie Clark', party: 'Bronze Party' },
  { id: 'c4', name: 'David Davis', party: 'Iron Party' },
  { id: 'c5', name: 'Eve Evans', party: 'Copper Party' },
]

const RANKS = 5

interface Props {
    onSwitchBallotType?: () => void
}

export const BabylonRCVBallot: React.FC<Props> = ({ onSwitchBallotType }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Map candidateId -> rank (1-based)
  const [selections, setSelections] = useState<Record<string, number>>({})
  const sceneRef = useRef<Scene | null>(null)
  const textureRef = useRef<DynamicTexture | null>(null)
  const ballotMeshRef = useRef<Mesh | null>(null)

  const drawBallot = (texture: DynamicTexture, currentSelections: Record<string, number>) => {
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D
    const width = 1024
    const height = 2048

    // Background
    ctx.fillStyle = '#fdfbf7'
    ctx.fillRect(0, 0, width, height)
    
    // Security pattern
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

    // Header
    ctx.fillStyle = '#000000'
    ctx.fillRect(40, 40, width - 80, 120)
    
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 44px "Times New Roman", serif'
    ;(ctx as any).textAlign = 'center'
    ctx.fillText('OFFICIAL RANKED CHOICE BALLOT', width/2, 100)
    ctx.font = 'bold 28px Arial, sans-serif'
    ctx.fillText('MUNICIPAL ELECTION • NOVEMBER 8, 2025', width/2, 145)

    // Instructions
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.strokeRect(40, 180, width - 80, 150)
    
    ctx.fillStyle = '#000000'
    ;(ctx as any).textAlign = 'left'
    ctx.font = 'bold 22px Arial, sans-serif'
    ctx.fillText('INSTRUCTIONS', 60, 215)
    ctx.font = '18px Arial, sans-serif'
    ctx.fillText('Rank candidates in order of preference.', 60, 245)
    ctx.fillText('Fill in the 1st column oval for your 1st choice, 2nd column for 2nd choice, etc.', 60, 270)
    ctx.fillText('Do not select more than one candidate per rank.', 60, 295)

    // Grid Setup
    const startY = 400
    const rowHeight = 120
    const nameColWidth = 350
    const rankColWidth = (width - 80 - nameColWidth) / RANKS

    // Column Headers
    ctx.fillStyle = '#dddddd'
    ctx.fillRect(40 + nameColWidth, startY - 50, width - 80 - nameColWidth, 50)
    
    ctx.fillStyle = '#000000'
    ;(ctx as any).textAlign = 'center'
    ctx.font = 'bold 20px Arial, sans-serif'
    for(let r=1; r<=RANKS; r++) {
        const x = 40 + nameColWidth + (r-1)*rankColWidth + rankColWidth/2
        ctx.fillText(r === 1 ? '1st' : r === 2 ? '2nd' : r === 3 ? '3rd' : `${r}th`, x, startY - 20)
        ctx.fillText('Choice', x, startY)
    }

    // Rows
    CANDIDATES.forEach((c, index) => {
        const y = startY + (index * rowHeight)
        
        // Alternating row background
        if (index % 2 === 0) {
            ctx.fillStyle = '#f4f4f4'
            ctx.fillRect(40, y, width - 80, rowHeight)
        }

        // Separator
        ctx.beginPath()
        ctx.moveTo(40, y + rowHeight)
        ctx.lineTo(width - 40, y + rowHeight)
        ctx.strokeStyle = '#cccccc'
        ctx.lineWidth = 1
        ctx.stroke()

        // Candidate Name
        ctx.fillStyle = '#000000'
        ;(ctx as any).textAlign = 'left'
        ctx.font = 'bold 32px Arial, sans-serif'
        ctx.fillText(c.name, 60, y + 50)
        ctx.font = 'italic 24px "Times New Roman", serif'
        ctx.fillText(c.party, 60, y + 90)

        // Ovals
        for(let r=1; r<=RANKS; r++) {
            const cx = 40 + nameColWidth + (r-1)*rankColWidth + rankColWidth/2
            const cy = y + rowHeight/2
            
            ctx.beginPath()
            ctx.ellipse(cx, cy, 25, 16, 0, 0, 2 * Math.PI)
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 2
            ctx.stroke()

            // Fill if selected
            if (currentSelections[c.id] === r) {
                ctx.fillStyle = '#000000'
                ctx.fill()
                // Marker look
                ctx.beginPath()
                ctx.ellipse(cx + 2, cy + 1, 22, 14, 0.1, 0, 2 * Math.PI)
                ctx.fillStyle = '#222222'
                ctx.fill()
            }
        }
    })
    
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
    scene.clearColor = new Color4(0.2, 0.2, 0.25, 1)

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

    // Desk
    const desk = MeshBuilder.CreateGround('desk', { width: 50, height: 50 }, scene)
    const deskMat = new StandardMaterial('deskMat', scene)
    deskMat.diffuseColor = new Color3(0.4, 0.25, 0.15)
    deskMat.specularColor = new Color3(0.1, 0.1, 0.1)
    desk.material = deskMat
    desk.position.y = -0.1

    // Ballot Mesh
    const ballotWidth = 8
    const ballotHeight = 16
    const ballot = MeshBuilder.CreateBox('ballot', { 
        width: ballotWidth, 
        height: ballotHeight, 
        depth: 0.02 
    }, scene)
    ballotMeshRef.current = ballot
    
    ballot.rotation.x = Math.PI / 2
    ballot.position.y = 0.05

    const mat = new StandardMaterial('ballotMat', scene)
    const texture = new DynamicTexture('ballotTexture', { width: 1024, height: 2048 }, scene, false)
    textureRef.current = texture
    
    mat.diffuseTexture = texture
    mat.specularColor = new Color3(0.05, 0.05, 0.05)
    mat.roughness = 0.9
    ballot.material = mat

    // Switch Button
    const switchBtn = MeshBuilder.CreateCylinder('switchBtn', { diameter: 2, height: 0.5 }, scene)
    switchBtn.position = new Vector3(8, 0.25, 2)
    const btnMat = new StandardMaterial('btnMat', scene)
    btnMat.diffuseColor = Color3.Blue()
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
    labelCtx.fillText('Standard', 128, 90)
    labelTexture.update()
    
    const labelMat = new StandardMaterial('labelMat', scene)
    labelMat.diffuseTexture = labelTexture
    labelMat.specularColor = Color3.Black()
    labelMat.emissiveColor = Color3.White()
    labelMat.backFaceCulling = false
    labelPlane.material = labelMat

    drawBallot(texture, {})

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
            const canvasY = (1 - uv.y) * 2048
            const canvasX = uv.x * 1024
            
            const startY = 400
            const rowHeight = 120
            const nameColWidth = 350
            const rankColWidth = (1024 - 80 - nameColWidth) / RANKS

            // Check if click is in grid area
            if (canvasY >= startY && canvasX >= 40 + nameColWidth) {
                const rowIndex = Math.floor((canvasY - startY) / rowHeight)
                const colIndex = Math.floor((canvasX - (40 + nameColWidth)) / rankColWidth)
                
                if (rowIndex >= 0 && rowIndex < CANDIDATES.length && colIndex >= 0 && colIndex < RANKS) {
                    const candidate = CANDIDATES[rowIndex]
                    const rank = colIndex + 1
                    
                    setSelections(prev => {
                        const newSelections = { ...prev }
                        
                        // Toggle off if clicking same
                        if (newSelections[candidate.id] === rank) {
                            delete newSelections[candidate.id]
                            return newSelections
                        }

                        // RCV Rule: One candidate per rank
                        // Remove any other candidate that has this rank
                        Object.keys(newSelections).forEach(key => {
                            if (newSelections[key] === rank) {
                                delete newSelections[key]
                            }
                        })

                        // RCV Rule: One rank per candidate
                        // (Implicitly handled by map structure: candidateId -> rank)
                        
                        newSelections[candidate.id] = rank
                        return newSelections
                    })
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

  useEffect(() => {
    if (textureRef.current) {
        drawBallot(textureRef.current, selections)
    }
  }, [selections])

  const castVote = () => {
    if (!ballotMeshRef.current || !sceneRef.current) return
    
    const frameRate = 60
    const zSlide = new Animation("zSlide", "position.z", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    const yDrop = new Animation("yDrop", "position.y", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)
    const xRot = new Animation("xRot", "rotation.x", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT)

    const keyFramesZ = [{ frame: 0, value: 0 }, { frame: 60, value: 15 }]
    const keyFramesY = [{ frame: 0, value: 0.05 }, { frame: 30, value: 0.05 }, { frame: 60, value: -5 }]
    const keyFramesRot = [{ frame: 0, value: Math.PI / 2 }, { frame: 60, value: Math.PI / 2 + Math.PI / 4 }]

    zSlide.setKeys(keyFramesZ)
    yDrop.setKeys(keyFramesY)
    xRot.setKeys(keyFramesRot)

    const easing = new CubicEase()
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEIN)
    zSlide.setEasingFunction(easing)

    sceneRef.current.beginDirectAnimation(ballotMeshRef.current, [zSlide, yDrop, xRot], 0, 60, false, 1, () => {
        setTimeout(() => {
            if (ballotMeshRef.current) {
                ballotMeshRef.current.position.y = 0.05
                ballotMeshRef.current.position.z = 0
                ballotMeshRef.current.rotation.x = Math.PI / 2
                setSelections({})
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
                disabled={Object.keys(selections).length === 0}
                className={`px-8 py-3 rounded-full font-bold text-xl shadow-lg transition-all ${
                    Object.keys(selections).length > 0
                    ? 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
                Cast RCV Vote
            </button>
        </div>
        <div className="absolute top-4 left-4 bg-white/80 p-4 rounded shadow backdrop-blur">
            <h2 className="font-bold text-lg">Ranked Choice Voting</h2>
            <p className="text-sm text-gray-600">Select your 1st, 2nd, 3rd choices.</p>
            <p className="text-sm text-gray-600">Rows = Candidates, Cols = Rank.</p>
        </div>
    </div>
  )
}

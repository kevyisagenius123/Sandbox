import React, { useEffect, useRef, useMemo } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  TransformNode,
  Scalar,
  GlowLayer,
  Mesh,
  PBRMaterial,
  Texture,
  CubeTexture,
  DynamicTexture
} from '@babylonjs/core'
import type { AggregateResults } from '../results-summary/types'

interface BabylonBallotDropProps {
  aggregates: AggregateResults
}

interface Ballot {
  mesh: Mesh
  targetY: number
  velocity: number
  state: 'falling' | 'settled'
  bounces: number
}

export const BabylonBallotDrop: React.FC<BabylonBallotDropProps> = ({ aggregates }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const ballotsRef = useRef<Ballot[]>([])
  const materialsRef = useRef<{dem: StandardMaterial, gop: StandardMaterial} | null>(null)
  
  // Configuration
  const MAX_BALLOTS = 400 
  const CONTAINER_WIDTH = 4
  const CONTAINER_DEPTH = 4
  const CONTAINER_HEIGHT = 8
  
  // Ballot Dimensions (US Letter-ish ratio)
  const BALLOT_WIDTH = 0.6
  const BALLOT_DEPTH = 0.8
  const BALLOT_THICKNESS = 0.01

  // Calculate target ballot counts
  const targets = useMemo(() => {
    const { totalVotes, voteMarginAbsolute, leader } = aggregates
    if (totalVotes === 0) return { dem: 0, gop: 0 }
    
    let demVotes = 0
    let gopVotes = 0
    
    if (leader === 'DEM') {
        gopVotes = (totalVotes - voteMarginAbsolute) / 2
        demVotes = totalVotes - gopVotes
    } else if (leader === 'GOP') {
        demVotes = (totalVotes - voteMarginAbsolute) / 2
        gopVotes = totalVotes - demVotes
    } else {
        demVotes = totalVotes / 2
        gopVotes = totalVotes / 2
    }

    const maxVote = Math.max(demVotes, gopVotes, 1)
    
    const demBallots = Math.floor((demVotes / maxVote) * (MAX_BALLOTS * 0.8))
    const gopBallots = Math.floor((gopVotes / maxVote) * (MAX_BALLOTS * 0.8))

    return { dem: demBallots, gop: gopBallots }
  }, [aggregates])

  useEffect(() => {
    if (!canvasRef.current) return

    const engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true, antialias: true })
    const scene = new Scene(engine)
    sceneRef.current = scene
    scene.clearColor = new Color4(0.05, 0.05, 0.1, 1)

    // Camera
    const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 20, Vector3.Zero(), scene)
    camera.lowerRadiusLimit = 10
    camera.upperRadiusLimit = 30
    camera.attachControl(canvasRef.current, true)

    // Lighting
    const light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene)
    light.intensity = 0.8
    
    // Glow Layer (Subtle)
    const gl = new GlowLayer("glow", scene)
    gl.intensity = 0.3

    // --- Materials ---
    // Create Ballot Textures
    const createBallotMaterial = (party: 'DEM' | 'GOP') => {
        const mat = new StandardMaterial(`${party}_ballot_mat`, scene)
        const dt = new DynamicTexture(`${party}_ballot_dt`, { width: 256, height: 340 }, scene, false)
        const ctx = dt.getContext() as unknown as CanvasRenderingContext2D
        
        // Paper Background
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(0, 0, 256, 340)
        
        // Header
        ctx.fillStyle = party === 'DEM' ? '#3b82f6' : '#ef4444'
        ctx.fillRect(0, 0, 256, 40)
        
        ctx.font = 'bold 24px Arial'
        ctx.fillStyle = 'white'
        ctx.textAlign = 'center'
        ctx.fillText('OFFICIAL BALLOT', 128, 28)
        
        // Fake Text Lines
        ctx.fillStyle = '#1e293b'
        for(let i=0; i<8; i++) {
            const y = 60 + i * 30
            ctx.fillRect(20, y, 20, 20) // Checkbox
            ctx.fillRect(50, y + 5, 180, 10) // Text line
        }
        
        // "Marked" Vote
        ctx.strokeStyle = party === 'DEM' ? '#1d4ed8' : '#b91c1c'
        ctx.lineWidth = 4
        ctx.beginPath()
        // Mark the first box for DEM, second for GOP (just for variety)
        const markY = party === 'DEM' ? 60 : 90
        ctx.moveTo(20, markY)
        ctx.lineTo(40, markY + 20)
        ctx.moveTo(40, markY)
        ctx.lineTo(20, markY + 20)
        ctx.stroke()
        
        dt.update()
        mat.diffuseTexture = dt
        mat.specularColor = new Color3(0.1, 0.1, 0.1) // Matte paper
        return mat
    }
    
    materialsRef.current = {
        dem: createBallotMaterial('DEM'),
        gop: createBallotMaterial('GOP')
    }

    // --- Environment ---
    const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 10 }, scene)
    const groundMat = new StandardMaterial('groundMat', scene)
    groundMat.diffuseColor = Color3.FromHexString("#1e293b")
    groundMat.specularColor = new Color3(0.1, 0.1, 0.1)
    ground.material = groundMat

    // Glass Material
    const glassMat = new PBRMaterial("glass", scene)
    glassMat.indexOfRefraction = 1.5
    glassMat.alpha = 0.3
    glassMat.directIntensity = 0.0
    glassMat.environmentIntensity = 0.7
    glassMat.cameraExposure = 0.66
    glassMat.cameraContrast = 1.66
    glassMat.microSurface = 1
    glassMat.reflectivityColor = new Color3(0.2, 0.2, 0.2)
    glassMat.albedoColor = new Color3(0.85, 0.85, 0.85)

    // Create Container Helper
    const createContainer = (xPos: number, label: string, colorHex: string) => {
        const root = new TransformNode(label, scene)
        root.position.x = xPos
        
        const color = Color3.FromHexString(colorHex)
        
        // Plastic Bin Material (Semi-transparent)
        const binMat = new PBRMaterial("binMat_" + label, scene)
        binMat.albedoColor = color
        binMat.reflectivityColor = new Color3(0.2, 0.2, 0.2)
        binMat.microSurface = 0.8
        binMat.alpha = 0.5 
        binMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
        binMat.backFaceCulling = false

        // Lid Material (Dark Plastic)
        const lidMat = new PBRMaterial("lidMat", scene)
        lidMat.albedoColor = new Color3(0.1, 0.1, 0.1)
        lidMat.roughness = 0.4
        lidMat.metallic = 0.0

        // Floor
        const floor = MeshBuilder.CreateBox("floor", { width: CONTAINER_WIDTH, depth: CONTAINER_DEPTH, height: 0.2 }, scene)
        floor.position.y = 0.1
        floor.parent = root
        floor.material = binMat

        // Walls
        const wallHeight = CONTAINER_HEIGHT
        const thickness = 0.1
        
        const left = MeshBuilder.CreateBox("left", { width: thickness, depth: CONTAINER_DEPTH, height: wallHeight }, scene)
        left.position.x = -CONTAINER_WIDTH/2
        left.position.y = wallHeight/2
        left.parent = root
        left.material = binMat
        
        const right = MeshBuilder.CreateBox("right", { width: thickness, depth: CONTAINER_DEPTH, height: wallHeight }, scene)
        right.position.x = CONTAINER_WIDTH/2
        right.position.y = wallHeight/2
        right.parent = root
        right.material = binMat
        
        const back = MeshBuilder.CreateBox("back", { width: CONTAINER_WIDTH, depth: thickness, height: wallHeight }, scene)
        back.position.z = CONTAINER_DEPTH/2
        back.position.y = wallHeight/2
        back.parent = root
        back.material = binMat
        
        const front = MeshBuilder.CreateBox("front", { width: CONTAINER_WIDTH, depth: thickness, height: wallHeight }, scene)
        front.position.z = -CONTAINER_DEPTH/2
        front.position.y = wallHeight/2
        front.parent = root
        front.material = binMat

        // Lid (Two pieces with gap for slot)
        const slotWidth = 1.4
        const lidWidth = (CONTAINER_WIDTH - slotWidth) / 2
        
        const lidLeft = MeshBuilder.CreateBox("lidLeft", { width: lidWidth, depth: CONTAINER_DEPTH + 0.2, height: 0.2 }, scene)
        lidLeft.position.x = -CONTAINER_WIDTH/2 + lidWidth/2
        lidLeft.position.y = wallHeight
        lidLeft.parent = root
        lidLeft.material = lidMat
        
        const lidRight = MeshBuilder.CreateBox("lidRight", { width: lidWidth, depth: CONTAINER_DEPTH + 0.2, height: 0.2 }, scene)
        lidRight.position.x = CONTAINER_WIDTH/2 - lidWidth/2
        lidRight.position.y = wallHeight
        lidRight.parent = root
        lidRight.material = lidMat

        // Label
        const plane = MeshBuilder.CreatePlane("label", { width: 3, height: 1.5 }, scene)
        plane.position.y = wallHeight / 2
        plane.position.z = -CONTAINER_DEPTH/2 - 0.06
        plane.parent = root
        
        const dt = new DynamicTexture("labelDT_" + label, {width: 512, height: 256}, scene)
        const ctx = dt.getContext() as unknown as CanvasRenderingContext2D
        ctx.fillStyle = colorHex
        ctx.fillRect(0,0,512,256)
        
        // Border
        ctx.strokeStyle = "white"
        ctx.lineWidth = 10
        ctx.strokeRect(10,10,492,236)

        ctx.fillStyle = "white"
        ctx.font = "bold 80px Arial"
        ctx.textAlign = "center"
        ctx.fillText(label, 256, 110)
        ctx.font = "40px Arial"
        ctx.fillText("DROP BOX", 256, 180)
        dt.update()
        
        const labelMat = new StandardMaterial("labelMat_" + label, scene)
        labelMat.diffuseTexture = dt
        plane.material = labelMat
        
        return root
    }

    createContainer(-4, "DEM", "#3b82f6")
    createContainer(4, "GOP", "#ef4444")

    // Animation Loop
    scene.registerBeforeRender(() => {
        const dt = engine.getDeltaTime() / 1000
        const gravity = -9.8
        
        ballotsRef.current.forEach(ballot => {
            if (ballot.state === 'falling') {
                ballot.velocity += gravity * dt
                ballot.mesh.position.y += ballot.velocity * dt
                
                // Check collision with "pile" (targetY)
                if (ballot.mesh.position.y <= ballot.targetY) {
                    ballot.mesh.position.y = ballot.targetY
                    
                    // Simple bounce (dampened heavily for paper)
                    if (ballot.bounces > 0 && Math.abs(ballot.velocity) > 0.5) {
                        ballot.velocity = -ballot.velocity * 0.2 // Very low bounce for paper
                        ballot.bounces--
                        ballot.mesh.position.y += 0.005 // Unstick
                    } else {
                        ballot.state = 'settled'
                        ballot.velocity = 0
                    }
                }
            }
        })
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

  // Handle Ballot Spawning
  useEffect(() => {
    if (!sceneRef.current || !materialsRef.current) return
    
    const currentBallots = ballotsRef.current
    const demBallots = currentBallots.filter(b => b.mesh.metadata?.party === 'DEM')
    const gopBallots = currentBallots.filter(b => b.mesh.metadata?.party === 'GOP')
    
    const spawnBallot = (party: 'DEM' | 'GOP', index: number) => {
        const xOffset = party === 'DEM' ? -4 : 4
        
        // Random position inside container (Constrained to slot width for X)
        const slotWidth = 1.4
        // We want them to fall through the slot, so constrain X to slot width minus ballot width
        const rx = (Math.random() - 0.5) * (slotWidth - BALLOT_WIDTH - 0.2) 
        const rz = (Math.random() - 0.5) * (CONTAINER_DEPTH - BALLOT_DEPTH - 0.2)
        
        // Calculate stack height
        // Papers stack densely but we want a "messy pile" look
        // Area = Width * Depth. Ballot Area = W * D.
        // Capacity per layer ~ (ContainerArea) / (BallotArea * 1.2)
        const ballotsPerLayer = Math.floor((CONTAINER_WIDTH * CONTAINER_DEPTH) / (BALLOT_WIDTH * BALLOT_DEPTH * 1.2))
        const layer = Math.floor(index / ballotsPerLayer)
        // Add some random height variation to simulate a messy pile
        const pileNoise = Math.random() * 0.2
        const targetY = 0.1 + (BALLOT_THICKNESS/2) + (layer * 0.05) + pileNoise

        const mesh = MeshBuilder.CreateBox("ballot", { 
            width: BALLOT_WIDTH, 
            height: BALLOT_THICKNESS, 
            depth: BALLOT_DEPTH 
        }, sceneRef.current!)
        
        mesh.position = new Vector3(xOffset + rx, 12 + Math.random() * 5, rz) // Spawn high up
        // Random rotation for "messy" look
        mesh.rotation.y = Math.random() * Math.PI * 2
        mesh.rotation.x = (Math.random() - 0.5) * 0.2 // Slight tilt
        mesh.rotation.z = (Math.random() - 0.5) * 0.2 // Slight tilt
        
        mesh.metadata = { party }
        mesh.material = party === 'DEM' ? materialsRef.current!.dem : materialsRef.current!.gop
        
        ballotsRef.current.push({
            mesh,
            targetY,
            velocity: 0,
            state: 'falling',
            bounces: 1 // Paper doesn't bounce much
        })
    }

    // Spawn DEM
    if (demBallots.length < targets.dem) {
        const needed = targets.dem - demBallots.length
        for(let i=0; i<needed; i++) {
            spawnBallot('DEM', demBallots.length + i)
        }
    }
    
    // Spawn GOP
    if (gopBallots.length < targets.gop) {
        const needed = targets.gop - gopBallots.length
        for(let i=0; i<needed; i++) {
            spawnBallot('GOP', gopBallots.length + i)
        }
    }
    
  }, [targets])

  return <canvas ref={canvasRef} className="w-full h-full outline-none" />
}

import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '@babylonjs/loaders'; // Import loaders for OBJ support
import { 
  Engine, 
  Scene, 
  ArcRotateCamera, 
  Vector3, 
  HemisphericLight, 
  MeshBuilder, 
  StandardMaterial, 
  Texture, 
  Color3, 
  Animation, 
  CubicEase, 
  EasingFunction,
  DynamicTexture,
  SpotLight,
  Mesh,
  SceneLoader
} from '@babylonjs/core';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ISceneLoaderPlugin } from '@babylonjs/core/Loading/sceneLoader';

const registerObjLoader = (() => {
  let registered = false;
  return () => {
    if (registered) return;
    const loader = new OBJFileLoader() as unknown as ISceneLoaderPlugin;
    SceneLoader.RegisterPlugin(loader);
    registered = true;
  };
})();

const BabylonCallPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    registerObjLoader();
    let isDisposed = false;

    // --- Setup ---
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color3(0.02, 0.02, 0.05).toColor4(); // Dark studio background

    // Camera
    const camera = new ArcRotateCamera("camera1", -Math.PI / 2, Math.PI / 2.5, 12, Vector3.Zero(), scene);
    camera.attachControl(canvasRef.current, true);
    camera.wheelPrecision = 50;
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 20;

    // Lights
    const ambientLight = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.3;

    const spotLight = new SpotLight("spot", new Vector3(0, 10, -10), new Vector3(0, -1, 1), Math.PI / 3, 2, scene);
    spotLight.intensity = 1.2;
    spotLight.diffuse = new Color3(1, 0.95, 0.9);

    // --- Materials ---
    const darkBlueMat = new StandardMaterial('darkBlue', scene);
    darkBlueMat.diffuseColor = Color3.FromHexString('#1e1b4b');
    darkBlueMat.emissiveColor = new Color3(0.1, 0.1, 0.2);
    
    const headerBlueMat = new StandardMaterial('headerBlue', scene);
    headerBlueMat.diffuseColor = Color3.FromHexString('#2e2a85');
    headerBlueMat.emissiveColor = new Color3(0.1, 0.1, 0.3);

    const pinkMat = new StandardMaterial('pink', scene);
    pinkMat.diffuseColor = Color3.FromHexString('#ec4899');
    pinkMat.emissiveColor = new Color3(0.2, 0.05, 0.1);

    const whiteMat = new StandardMaterial('white', scene);
    whiteMat.diffuseColor = Color3.White();
    whiteMat.emissiveColor = new Color3(0.1, 0.1, 0.1);

    const redMat = new StandardMaterial('red', scene);
    redMat.diffuseColor = Color3.FromHexString('#ef4444');
    redMat.emissiveColor = new Color3(0.2, 0.05, 0.05);

    const blueMat = new StandardMaterial('blue', scene);
    blueMat.diffuseColor = Color3.FromHexString('#3b82f6');
    blueMat.emissiveColor = new Color3(0.05, 0.1, 0.2);

    const yellowMat = new StandardMaterial('yellow', scene);
    yellowMat.diffuseColor = Color3.FromHexString('#facc15');
    yellowMat.emissiveColor = new Color3(0.3, 0.3, 0);
    
    const footerMat = new StandardMaterial('footer', scene);
    footerMat.diffuseColor = Color3.FromHexString('#17153b');
    footerMat.emissiveColor = new Color3(0.1, 0.1, 0.2);

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
      const planeWidth = options.width;
      const planeHeight = options.height;
      const textureWidth = 1024; // Good resolution
      const textureHeight = Math.ceil(textureWidth * (planeHeight / planeWidth));
      
      const plane = MeshBuilder.CreatePlane('textPlane', { width: planeWidth, height: planeHeight }, scene);
      const dt = new DynamicTexture('dynamicTexture', { width: textureWidth, height: textureHeight }, scene, true);
      dt.hasAlpha = true;
      
      const ctx = dt.getContext() as CanvasRenderingContext2D;
      const fontSize = options.fontSize ? (options.fontSize * (textureWidth / 512)) : (60 * (textureWidth / 512));
      const font = `${options.bold ? 'bold' : ''} ${fontSize}px ${options.fontFamily || 'Arial, sans-serif'}`;
      ctx.font = font;

      ctx.fillStyle = options.color;
      ctx.textBaseline = 'middle';
      
      const textWidth = ctx.measureText(text).width;
      let x = 0;
      if (options.align === 'center') x = (textureWidth - textWidth) / 2;
      else if (options.align === 'right') x = textureWidth - textWidth - 40;
      else x = 40;

      ctx.fillText(text, x, textureHeight / 2);
      dt.update();
      
      const mat = new StandardMaterial('textMat', scene);
      mat.diffuseTexture = dt;
      mat.opacityTexture = dt;
      mat.emissiveColor = Color3.White();
      mat.disableLighting = true;
      mat.backFaceCulling = false;
      plane.material = mat;
      
      return plane;
    };

    // --- Build Banner Geometry ---
    const bannerRoot = new TransformNode('bannerRoot', scene);
    
    // 1. Header (State Name)
    const headerBox = MeshBuilder.CreateBox('headerBox', { width: 10, height: 1.5, depth: 0.2 }, scene);
    headerBox.material = headerBlueMat;
    headerBox.position.y = 2.25;
    headerBox.parent = bannerRoot;
    
    const headerText = createTextPlane('ELECTION RESULTS', { width: 9, height: 1.2, color: 'white', fontSize: 50, bold: true, align: 'left', fontFamily: 'Inter' });
    headerText.parent = headerBox;
    headerText.position.z = -0.11;
    headerText.position.x = 0.2;

    // 2. Electoral Bar
    const electoralBox = MeshBuilder.CreateBox('electoralBox', { width: 10, height: 0.5, depth: 0.2 }, scene);
    electoralBox.material = pinkMat;
    electoralBox.position.y = 1.25;
    electoralBox.parent = bannerRoot;
    
    const electoralText = createTextPlane('CLASS 2 MOD ELECTION', { width: 9.5, height: 0.4, color: 'white', fontSize: 30, bold: true, align: 'left', fontFamily: 'Inter' });
    electoralText.parent = electoralBox;
    electoralText.position.z = -0.11;
    electoralText.position.x = 0.2;

    // 3. Candidates
    const candidates = [
        { name: 'u/PickleArtGeek', votes: '4', pct: '28.6%', color: '#22c55e', party: 'Unaffiliated' },
        { name: 'u/Disguised_VW_Beetle', votes: '3', pct: '21.4%', color: '#6366f1', party: 'Unaffiliated' },
        { name: 'u/Representative-Fee65', votes: '2', pct: '14.3%', color: '#ef4444', party: 'TSP' },
        { name: 'u/Max_flares', votes: '2', pct: '14.3%', color: '#eab308', party: 'CSUF' },
        { name: 'u/gunsmokeon', votes: '1', pct: '7.1%', color: '#d946ef', party: 'Unaffiliated' },
        { name: 'u/Alxuntmd', votes: '1', pct: '7.1%', color: '#14b8a6', party: 'Unaffiliated' },
        { name: 'u/BootEdgeEdge2028', votes: '1', pct: '7.1%', color: '#7f1d1d', party: 'Unaffiliated' }
    ];

    const createCandidateRow = (yPos: number, name: string, votes: string, pct: string, colorHex: string, isWinner: boolean) => {
        const rowHeight = 0.8;
        const rowBox = MeshBuilder.CreateBox('rowBox', { width: 10, height: rowHeight, depth: 0.2 }, scene);
        rowBox.material = whiteMat;
        rowBox.position.y = yPos;
        rowBox.parent = bannerRoot;

        // Party Bar
        const partyMat = new StandardMaterial(`partyMat_${name}`, scene);
        partyMat.diffuseColor = Color3.FromHexString(colorHex);
        partyMat.emissiveColor = Color3.FromHexString(colorHex).scale(0.6);

        const partyBar = MeshBuilder.CreateBox('partyBar', { width: 0.3, height: rowHeight, depth: 0.22 }, scene);
        partyBar.material = partyMat;
        partyBar.parent = rowBox;
        partyBar.position.x = -4.85;
        
        // Name
        const nameText = createTextPlane(name, { width: 5.5, height: rowHeight * 0.8, color: '#0f172a', fontSize: 30, bold: true, align: 'left', fontFamily: 'Inter' });
        nameText.parent = rowBox;
        nameText.position.x = -1.0;
        nameText.position.z = -0.11;
        
        // Votes
        const votesText = createTextPlane(votes, { width: 3, height: rowHeight * 0.5, color: '#0f172a', fontSize: 25, bold: true, align: 'right', fontFamily: 'Inter' });
        votesText.parent = rowBox
        votesText.position.x = 3.2;
        votesText.position.y = 0.15;
        votesText.position.z = -0.11;
        
        // Percent
        const pctText = createTextPlane(pct, { width: 3, height: rowHeight * 0.5, color: '#0f172a', fontSize: 22, bold: false, align: 'right', fontFamily: 'Inter' });
        pctText.parent = rowBox
        pctText.position.x = 3.2;
        pctText.position.y = -0.15;
        pctText.position.z = -0.11;

        // Winner Check
        if (isWinner) {
            const checkBg = MeshBuilder.CreateDisc('checkBg', { radius: 0.25, tessellation: 32 }, scene);
            checkBg.material = yellowMat;
            checkBg.parent = rowBox
            checkBg.position.x = -4.4;
            checkBg.position.z = -0.15; 
            
            const checkText = createTextPlane('✓', { width: 0.5, height: 0.5, color: 'black', fontSize: 200, bold: true, align: 'center' });
            checkText.parent = rowBox
            checkText.position.x = -4.4;
            checkText.position.z = -0.16; 
        }
    };

    // Generate rows dynamically
    let startY = 0.5;
    const spacing = 0.9;
    candidates.forEach((c, i) => {
        createCandidateRow(startY - (i * spacing), c.name, c.votes, c.pct, c.color, i === 0);
    });

    // 4. Footer
    const footerBox = MeshBuilder.CreateBox('footerBox', { width: 10, height: 0.8, depth: 0.2 }, scene);
    footerBox.material = footerMat;
    footerBox.position.y = startY - (candidates.length * spacing) - 0.5; // Position below last candidate
    footerBox.parent = bannerRoot;
    
    const footerText = createTextPlane('25% REPORTED   |   TOTAL: 14 VOTES   |   EST: 3:42 PM EST', { width: 9.5, height: 0.6, color: 'white', fontSize: 20, bold: true, align: 'center', fontFamily: 'Inter' });
    footerText.parent = footerBox;
    footerText.position.z = -0.11;

    // Animation Loop for Banner
    scene.registerBeforeRender(() => {
        // Gentle floating animation
        const t = performance.now() * 0.001;
        bannerRoot.rotation.y = Math.sin(t * 0.5) * 0.05;
        bannerRoot.rotation.x = Math.sin(t * 0.4) * 0.02;
    });

    // 5. Logo (Decision Desk Spin Room)
    const logoPlane = MeshBuilder.CreatePlane("logoPlane", { width: 3, height: 3 }, scene);
    logoPlane.position.y = 4.5; // Above the header
    logoPlane.parent = bannerRoot;
    
    const logoMat = new StandardMaterial("logoMat", scene);
    const logoTexture = new Texture("/assets/textures/election-call-bg.webp", scene);
    logoTexture.hasAlpha = true;
    logoMat.diffuseTexture = logoTexture;
    logoMat.emissiveColor = new Color3(1, 1, 1);
    logoMat.disableLighting = true;
    logoPlane.material = logoMat;


    // --- Animations ---
    const animateIn = (mesh: TransformNode, startY: number, endY: number, delay: number) => {
        const anim = new Animation("anim", "position.y", 60, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const keys = [
            { frame: 0, value: startY },
            { frame: 60, value: endY }
        ];
        anim.setKeys(keys);
        const ease = new CubicEase();
        ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        anim.setEasingFunction(ease);
        mesh.animations.push(anim);
        setTimeout(() => scene.beginAnimation(mesh, 0, 60, false), delay);
    };

    // Initial positions (off screen)
    bannerRoot.position.y = -10;

    // Run animations
    animateIn(bannerRoot, -10, 0, 0);


    // Render Loop
    engine.runRenderLoop(() => {
      if (isDisposed) return;
      scene.render();
    });

    // Resize Handler
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center z-10">
        <h1 className="text-white text-xl font-bold">Babylon.js Election Call</h1>
        <Link to="/" className="text-blue-400 hover:text-blue-300">Back to Home</Link>
      </header>
      <div className="flex-grow relative">
        <canvas ref={canvasRef} className="w-full h-full outline-none absolute inset-0" />
        <div className="absolute bottom-4 right-4 text-white pointer-events-none text-right">
            <h2 className="text-xl font-bold">ARIZONA CALL</h2>
            <p className="text-sm opacity-70">99% Reporting</p>
        </div>
      </div>
    </div>
  );
};

export default BabylonCallPage;

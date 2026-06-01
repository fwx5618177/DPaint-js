import {$div} from "../../util/dom.js";

let RulerOverlay = ((viewport,container,getView)=>{
    let me = {};
    let visible = false;
    let guides = [];
    let activeGuide;
    let topCanvas;
    let leftCanvas;
    let topIndicator;
    let leftIndicator;
    let rulerContainer;
    let resizeObserver;
    const rulerSize = 18;

    me.toggle = ()=>{
        me.setVisible(!visible);
    }

    me.setVisible = state=>{
        visible = !!state;
        ensure();
        rulerContainer.classList.toggle("visible",visible);
        container.classList.toggle("rulersvisible",visible);
        if (!visible) hideCursorIndicator();
        me.update();
    }

    me.update = ()=>{
        if (!visible) return;
        ensure();
        guides = guides.filter(guide=>{
            if (isInImage(guide)) return true;
            guide.element.remove();
            return false;
        });
        guides.forEach(positionGuide);
        drawRulers();
    }

    me.getInset = ()=>{
        if (!visible) return {left:0,top:0};
        return {left:rulerSize,top:rulerSize};
    }

    function ensure(){
        if (rulerContainer) return;

        rulerContainer = $div("rulers","",viewport);
        topCanvas = document.createElement("canvas");
        topCanvas.className = "top handle";
        leftCanvas = document.createElement("canvas");
        leftCanvas.className = "left handle";
        $div("corner","",rulerContainer);
        rulerContainer.appendChild(topCanvas);
        rulerContainer.appendChild(leftCanvas);
        topIndicator = $div("cursorindicator top","",rulerContainer);
        leftIndicator = $div("cursorindicator left","",rulerContainer);

        topCanvas.onDragStart = e=>startGuide("horizontal",e);
        topCanvas.onDrag = (x,y,data,e)=>dragGuide(e);
        topCanvas.onDragEnd = endGuide;
        leftCanvas.onDragStart = e=>startGuide("vertical",e);
        leftCanvas.onDrag = (x,y,data,e)=>dragGuide(e);
        leftCanvas.onDragEnd = endGuide;
        viewport.addEventListener("pointermove",updateCursorIndicator);
        viewport.addEventListener("pointerleave",hideCursorIndicator);

        if (window.ResizeObserver){
            resizeObserver = new ResizeObserver(me.update);
            resizeObserver.observe(viewport);
        }
    }

    function startGuide(type,e){
        activeGuide = addGuide(type,0);
        dragGuide(e);
    }

    function dragGuide(e){
        if (!activeGuide) return;
        hideCursorIndicator();
        let point = screenToImage(e);
        activeGuide.position = activeGuide.type === "vertical" ? point.x : point.y;
        positionGuide(activeGuide);
    }

    function endGuide(e){
        if (!activeGuide) return;
        if (!isInView(e) || !isInImage(activeGuide)){
            removeGuide(activeGuide);
        }else{
            activeGuide.position = Math.round(activeGuide.position);
            positionGuide(activeGuide);
        }
        activeGuide = undefined;
    }

    function addGuide(type,position){
        let guide = {
            type,
            position,
            element: $div("rulerguide handle " + type,"",container)
        };
        guide.element.onDragStart = ()=>{
            activeGuide = guide;
            guide.startPosition = guide.position;
        };
        guide.element.onDrag = (x,y)=>{
            let view = getView();
            let delta = guide.type === "vertical" ? x : y;
            guide.position = guide.startPosition + delta/view.zoom;
            positionGuide(guide);
        };
        guide.element.onDragEnd = endGuide;
        guides.push(guide);
        return guide;
    }

    function updateCursorIndicator(e){
        if (!visible || !e.target.classList.contains("maincanvas")){
            hideCursorIndicator();
            return;
        }

        let point = screenToImage(e);
        let view = getView();
        if (point.x < 0 || point.x >= view.width || point.y < 0 || point.y >= view.height){
            hideCursorIndicator();
            return;
        }

        let rect = viewport.getBoundingClientRect();
        topIndicator.style.left = (e.clientX - rect.left) + "px";
        leftIndicator.style.top = (e.clientY - rect.top) + "px";
        topIndicator.classList.add("visible");
        leftIndicator.classList.add("visible");
    }

    function hideCursorIndicator(){
        if (!topIndicator) return;
        topIndicator.classList.remove("visible");
        leftIndicator.classList.remove("visible");
    }

    function removeGuide(guide){
        guide.element.remove();
        guides = guides.filter(item=>item !== guide);
    }

    function positionGuide(guide){
        let view = getView();
        let position = Math.round(guide.position) * view.zoom;
        if (guide.type === "vertical"){
            guide.element.style.left = position + "px";
        }else{
            guide.element.style.top = position + "px";
        }
    }

    function screenToImage(e){
        let view = getView();
        let rect = viewport.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left - view.transform.x)/view.zoom),
            y: Math.round((e.clientY - rect.top - view.transform.y)/view.zoom)
        };
    }

    function isInView(e){
        let rect = viewport.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    }

    function isInImage(guide){
        let view = getView();
        let position = Math.round(guide.position);
        let size = guide.type === "vertical" ? view.width : view.height;
        return position >= 0 && position < size;
    }

    function drawRulers(){
        let view = getView();
        let rect = viewport.getBoundingClientRect();
        drawRuler(topCanvas,rect.width - rulerSize,rulerSize,"horizontal",view);
        drawRuler(leftCanvas,rulerSize,rect.height - rulerSize,"vertical",view);
    }

    function drawRuler(canvas,width,height,type,view){
        let scale = window.devicePixelRatio || 1;
        width = Math.max(1,Math.floor(width));
        height = Math.max(1,Math.floor(height));
        if (canvas.width !== width*scale || canvas.height !== height*scale){
            canvas.width = width*scale;
            canvas.height = height*scale;
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
        }

        let ctx = canvas.getContext("2d");
        ctx.setTransform(scale,0,0,scale,0,0);
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle = "#242424";
        ctx.fillRect(0,0,width,height);
        ctx.strokeStyle = "#626262";
        ctx.fillStyle = "#bdbdbd";
        ctx.font = "9px sans-serif";
        ctx.textBaseline = "top";

        let size = type === "horizontal" ? view.width : view.height;
        let pan = type === "horizontal" ? view.transform.x - rulerSize : view.transform.y - rulerSize;
        let length = type === "horizontal" ? width : height;
        let step = getStep(view.zoom);
        let first = Math.max(0,Math.floor(-pan/view.zoom/step)*step);

        for (let value = first; value <= size; value += step){
            let pos = Math.round(value*view.zoom + pan) + 0.5;
            if (pos < 0 || pos > length) continue;
            drawTick(ctx,type,pos,width,height,10);
            if (value% (step*2) === 0) drawLabel(ctx,type,value,pos,width,height);
        }

        if (view.zoom >= 4){
            let firstPixel = Math.max(0,Math.floor(-pan/view.zoom));
            let lastPixel = Math.min(size,Math.ceil((length - pan)/view.zoom));
            ctx.strokeStyle = "#464646";
            for (let value = firstPixel; value <= lastPixel; value++){
                if (value%step === 0) continue;
                let pos = Math.round(value*view.zoom + pan) + 0.5;
                drawTick(ctx,type,pos,width,height,4);
            }
        }
    }

    function drawTick(ctx,type,pos,width,height,size){
        ctx.beginPath();
        if (type === "horizontal"){
            ctx.moveTo(pos,height);
            ctx.lineTo(pos,height - size);
        }else{
            ctx.moveTo(width,pos);
            ctx.lineTo(width - size,pos);
        }
        ctx.stroke();
    }

    function drawLabel(ctx,type,value,pos,width,height){
        if (type === "horizontal"){
            ctx.fillText(value,pos + 2,2);
        }else{
            ctx.save();
            ctx.translate(2,pos - 2);
            ctx.rotate(-Math.PI/2);
            ctx.fillText(value,0,0);
            ctx.restore();
        }
    }

    function getStep(zoom){
        let steps = [1,2,5,10,20,50,100,200,500,1000];
        return steps.find(step=>step*zoom >= 24) || 1000;
    }

    return me;
});

export default RulerOverlay;

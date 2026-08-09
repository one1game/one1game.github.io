import{p as e}from"./math.scalar.functions-CQA38JRp.js";import{t}from"./shaderStore-D-XQlhUT.js";import{t as n}from"./bonesDeclaration-DANAGE80.js";import{n as r,t as i}from"./bakedVertexAnimation-7XIMgH6x.js";import{t as a}from"./morphTargetsVertexGlobalDeclaration-CamIxgP-.js";import{t as o}from"./morphTargetsVertexDeclaration-CkdjB1yU.js";import{t as s}from"./instancesDeclaration-CJBvtBV5.js";import{t as c}from"./morphTargetsVertexGlobal-D84rvgfO.js";import{t as l}from"./morphTargetsVertex-DE5wR_op.js";import{t as u}from"./instancesVertex-C-FoRQR1.js";import{t as d}from"./bonesVertex-B5Sconud.js";var f=e({iblVoxelGridVertexShader:()=>g}),p=`iblVoxelGridVertexShader`,m=`attribute vec3 position;varying vec3 vNormalizedPosition;
#include<bonesDeclaration>
#include<bakedVertexAnimationDeclaration>
#include<instancesDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
uniform mat4 invWorldScale;uniform mat4 viewMatrix;void main(void) {vec3 positionUpdated=position;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
#include<bakedVertexAnimation>
vec4 worldPos=finalWorld*vec4(positionUpdated,1.0);gl_Position=viewMatrix*invWorldScale*worldPos;vNormalizedPosition.xyz=gl_Position.xyz*0.5+0.5;
#ifdef IS_NDC_HALF_ZRANGE
gl_Position.z=gl_Position.z*0.5+0.5;
#endif
}`;t.ShadersStore[p]||(t.ShadersStore[p]=m);var h=[n,r,s,a,o,c,l,u,d,i];for(let e of h)t.IncludesShadersStore[e.name]||(t.IncludesShadersStore[e.name]=e.shader);var g={name:p,shader:m};export{f as t};
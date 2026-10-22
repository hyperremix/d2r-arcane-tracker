; Hook for the middle of a D2R function (see ground_hooks.cpp). It saves the registers the game still
; needs, calls ArcaneGroundLabelHook(unit = rsi, name buffer = rbp + 1E0h, capacity = 80h), restores
; them and continues in the original code through the trampoline D2RLoader made.
EXTERN ArcaneGroundLabelHook:PROC
EXTERN g_arcaneGroundLabelOriginal:QWORD
PUBLIC ArcaneGroundLabelStub

.code
ArcaneGroundLabelStub PROC
	pushfq
	push rax
	push rcx
	push rdx
	push r8
	push r9
	push r10
	push r11
	sub rsp, 80h
	movdqu xmmword ptr [rsp + 20h], xmm0
	movdqu xmmword ptr [rsp + 30h], xmm1
	movdqu xmmword ptr [rsp + 40h], xmm2
	movdqu xmmword ptr [rsp + 50h], xmm3
	movdqu xmmword ptr [rsp + 60h], xmm4
	movdqu xmmword ptr [rsp + 70h], xmm5
	mov rcx, rsi
	lea rdx, [rbp + 1E0h]
	mov r8d, 80h
	call ArcaneGroundLabelHook
	movdqu xmm0, xmmword ptr [rsp + 20h]
	movdqu xmm1, xmmword ptr [rsp + 30h]
	movdqu xmm2, xmmword ptr [rsp + 40h]
	movdqu xmm3, xmmword ptr [rsp + 50h]
	movdqu xmm4, xmmword ptr [rsp + 60h]
	movdqu xmm5, xmmword ptr [rsp + 70h]
	add rsp, 80h
	pop r11
	pop r10
	pop r9
	pop r8
	pop rdx
	pop rcx
	pop rax
	popfq
	jmp qword ptr [g_arcaneGroundLabelOriginal]
ArcaneGroundLabelStub ENDP
END

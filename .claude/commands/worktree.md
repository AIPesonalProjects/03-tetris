---
description: Crea un git worktree aislado para un requerimiento y ejecuta ahí las instrucciones dadas
argument-hint: <descripción del requerimiento / instrucciones>
---

Requerimiento recibido: $ARGUMENTS

Pasos a seguir:

1. Deriva un nombre corto en kebab-case (2-4 palabras) que resuma el requerimiento anterior. Este será `[nombre]`.
2. Verifica que exista el directorio `.trees/` en la raíz del repo; si no existe, créalo.
3. Crea una nueva rama y worktree aislado ejecutando:
   `git worktree add .trees/[nombre] -b [nombre]`
   - Si ya existe una rama o carpeta con ese nombre, ajusta el nombre (agrega sufijo numérico) para evitar colisión.
4. Confirma que el worktree se creó correctamente (`git worktree list`).
5. Cambia tu contexto de trabajo a esa carpeta `.trees/[nombre]` para todas las acciones subsecuentes (lecturas, ediciones, comandos) relacionadas con este requerimiento. No modifiques archivos en el checkout principal.
6. Ejecuta ahí, de manera aislada, las instrucciones del requerimiento ($ARGUMENTS) como si fuera una tarea normal de ingeniería: entender el código, implementar, probar.
7. Al finalizar, reporta: nombre del worktree/rama creado, ruta, y resumen de los cambios hechos dentro de él. No hagas merge, push ni elimines el worktree salvo que el usuario lo pida explícitamente.

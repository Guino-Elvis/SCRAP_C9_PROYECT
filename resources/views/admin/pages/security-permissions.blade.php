@section('title', 'Seguridad - Permisos')
@section('header', 'Seguridad')
@section('section', 'Permisos')

<div>
    <x-card>
        <div class="flex flex-col sm:flex-row sm:justify-between text-center gap-2">
            <div class="flex-1">
                <x-search />
            </div>
            <div class="flex justify-center gap-2" align="right">
                <button wire:click="create()"
                    class="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 active:from-blue-700 active:to-indigo-700 text-sm text-white font-semibold tracking-wide cursor-pointer shadow-lg">
                    <i class="fa-solid fa-plus"></i> Nuevo
                </button>
            </div>

        </div>
    </x-card>
    @if ($isOpen)
        @include('admin.modals.permission')
    @endif

    <x-card>
        <div class="shadow-lg border-b border-gray-200 rounded-lg overflow-auto">
            <table class="w-full table-auto">
                <thead class="bg-indigo-600 text-white">
                    <tr class="text-center text-xs font-bold uppercase">
                        <td scope="col" class="px-6 py-3">ID</td>
                        <td scope="col" class="px-6 py-3">Nombre</td>
                        <th scope="col" class="px-6 py-3">Acciones</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-300 bg-white">
                    @foreach ($permissions as $index => $permission)
                        <tr class="text-sm font-medium text-gray-900 hover:bg-gray-100">
                            <td class="p-4 text-center">
                                <span
                                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-700 text-white">
                                    {{ $index + 1 }}
                                </span>
                            </td>
                            <td class="p-4 text-center">{{ $permission->name }}</td>
                            <td class="p-4 w-10 space-y-2">
                                <div class="flex justify-center gap-2">
                                    <x-button wire:click="edit({{ $permission }})" class="rounded-md">
                                        <i class="fa-regular fa-pen-to-square"></i>
                                    </x-button>
                                    <x-button  wire:click="$emit('modalDelete',{{ $permission->id }})"
                                        class="rounded-md">
                                        <i class="fa-regular fa-trash-can"></i>
                                    </x-button>
                                </div>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        @if (!$permissions->count())
            <div class="text-center pt-4">
                <span class="text-slate-600 mt-2 text-sm">Ningún dato disponible en esta tabla</span>
            </div>
        @endif
        @if ($permissions->hasPages())
            <div class="px-6 py-3">
                {{ $permissions->links() }}
            </div>
        @endif
    </x-card>


    <div>
        @push('js')
            <script>
                Livewire.on('modalDelete', id => {
                    Swal.fire({
                        title: '¿Estas seguro?',
                        text: "¡No podrás revertir esto!",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: '¡Sí, bórralo!',
                        cancelButtonText: 'Cancelar'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            Livewire.emitTo('security-permissions', 'delete', id);
                            Swal.fire(
                                '¡Eliminado!',
                                'Su archivo ha sido eliminado.',
                                'success'
                            )

                        }
                    })
                });
            </script>
        @endpush
    </div>
</div>

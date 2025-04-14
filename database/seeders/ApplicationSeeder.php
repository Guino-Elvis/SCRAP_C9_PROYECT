<?php

namespace Database\Seeders;

use App\Models\Application;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ApplicationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */


    public function run()
    {
        // Verificar que las tablas relacionadas tengan datos
        $this->checkRelatedTables();

        // Obtener IDs existentes de las tablas relacionadas
        $postulantesIds = DB::table('postulantes')->pluck('id')->toArray();
        $usersIds = DB::table('users')->pluck('id')->toArray();
        $ofertasIds = DB::table('oferta_laborals')->pluck('id')->toArray();

        // Estados posibles para las aplicaciones
        $statuses = ['PE', 'AP', 'RE'];

     
        $applications = [];
        for ($i = 0; $i < 1000; $i++) {
            $fechaPostulacion = Carbon::now()->subDays(rand(0, 365));
            
            $applications[] = [
                'status' => $statuses[array_rand($statuses)],
                'numero' => 'APP-' . str_pad($i + 1, 5, '0', STR_PAD_LEFT),
                'fecha_postulacion' => $fechaPostulacion,
                'documentos' => json_encode([
                    'cv' => 'documentos/cv_' . rand(1000, 9999) . '.pdf',
                    'certificados' => 'documentos/cert_' . rand(1000, 9999) . '.pdf',
                    'otros' => 'documentos/otros_' . rand(1000, 9999) . '.zip'
                ]),
                'postulante_id' => $this->getRandomId($postulantesIds),
                'user_id' => $this->getRandomId($usersIds),
                'oferta_laboral_id' => $this->getRandomId($ofertasIds),
                'creado' => $fechaPostulacion,
                'created_at' => $fechaPostulacion,
                'updated_at' => $fechaPostulacion,
            ];

            // Insertar en lotes de 100 para mejor performance
            if ($i % 100 === 0 && !empty($applications)) {
                DB::table('applications')->insert($applications);
                $applications = [];
            }
        }

        // Insertar los registros restantes
        if (!empty($applications)) {
            DB::table('applications')->insert($applications);
        }

        $this->command->info('Se insertaron 1000 aplicaciones laborales aleatorias.');
    }

    /**
     * Verifica que las tablas relacionadas tengan datos
     */
    protected function checkRelatedTables()
    {
        if (DB::table('postulantes')->count() === 0) {
            throw new \Exception("La tabla 'postulantes' está vacía. Debe tener registros para crear aplicaciones.");
        }

        if (DB::table('users')->count() === 0) {
            throw new \Exception("La tabla 'users' está vacía. Debe tener registros para crear aplicaciones.");
        }

        if (DB::table('oferta_laborals')->count() === 0) {
            throw new \Exception("La tabla 'oferta_laborals' está vacía. Debe tener registros para crear aplicaciones.");
        }
    }

    /**
     * Obtiene un ID aleatorio de un array, con manejo de arrays vacíos
     */
    protected function getRandomId(array $ids)
    {
        if (empty($ids)) {
            throw new \Exception("No hay IDs disponibles para seleccionar.");
        }
        return $ids[array_rand($ids)];
    }
}
//php artisan db:seed --class=ApplicationSeeder 

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('oferta_laboral_recientes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('oferta_laboral_id');
            $table->foreign('oferta_laboral_id')->references('id')->on('oferta_laborals')->onDelete('cascade');
            $table->enum('marcado', [0, 1]); //1:no marcado  2:marcado
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('oferta_laboral_recientes');
    }
};

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const puppeteer = require('puppeteer')
const randomUseragent = require('random-useragent')
const mysql = require('mysql2') // Importa mysql2
const db = require('./db') // Importa la conexión a la base de datos
const moment = require('moment')

const app = express()

// Configura CORS para permitir solicitudes desde cualquier origen
app.use(cors())

app.use(bodyParser.json()) // Asegúrate de usar el middleware para manejar JSON
app.use(express.static('public')) // Servir archivos estáticos como HTML

let scrapingProcess = null // Variable para almacenar el proceso de scraping
let cancelScraping = false // Variable para controlar la cancelación del scraping

const convertirFecha = fecha => {
    return moment(fecha, 'DD-MM-YYYY').format('YYYY-MM-DD')
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// Asegura que la conexión a la base de datos esté activa
const ensureDbConnection = () => {
    return new Promise((resolve, reject) => {
        db.query('SELECT 1', err => {
            if (err) {
                console.log('Conexión perdida. Creando una nueva conexión...')
                db.end(() => {
                    resolve()
                })
            } else {
                resolve() // La conexión está activa
            }
        })
    })
}
const limpiarRazonSocial = razonSocial => {
    if (!razonSocial) return null

    // Convertir a mayúsculas, eliminar espacios extras y caracteres especiales
    return razonSocial
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ') // Reemplazar múltiples espacios por uno solo
        .replace(/[^A-Z0-9ÁÉÍÓÚÑ\s]/g, '') // Eliminar caracteres especiales excepto letras, números y espacios
}

const checkEmpresaExistente = async (ra_social, ruc) => {
    return new Promise((resolve, reject) => {
        // Validar que al menos uno de los parámetros tenga valor
        if (
            (!ra_social || ra_social.trim() === '') &&
            (!ruc || ruc.trim() === '')
        ) {
            return resolve(null)
        }

        // Limpiar y normalizar los datos
        const razonSocialLimpia = ra_social
            ? limpiarRazonSocial(ra_social)
            : null
        const rucLimpio = ruc ? ruc.toString().trim() : null

        // Construir la consulta dinámicamente según los parámetros disponibles
        let query = 'SELECT id FROM empresas WHERE '
        const params = []
        let conditions = []

        if (razonSocialLimpia) {
            conditions.push('UPPER(TRIM(ra_social)) = ?')
            params.push(razonSocialLimpia)
        }

        if (rucLimpio) {
            conditions.push('ruc = ?')
            params.push(rucLimpio)
        }

        // Usar AND en lugar de OR para mayor precisión
        query += conditions.join(' OR ')
        query += ' LIMIT 1'

        db.query(query, params, (err, results) => {
            if (err) {
                console.error('Error en checkEmpresaExistente:', err)
                reject(err)
            } else {
                resolve(results.length > 0 ? results[0].id : null)
            }
        })
    })
}

const generarRucUnico = async () => {
    let ruc
    let existe
    do {
        ruc = Math.floor(10000000000 + Math.random() * 90000000000).toString()
        // Solo verificamos por RUC, no por nombre de empresa
        existe = await checkEmpresaExistente(null, ruc)
    } while (existe)
    return ruc
}

const getRandomLocation = async () => {
    try {
        // Paso 1: Obtener un departamento aleatorio
        const [departamento] = await db.promise().query(`
            SELECT * FROM departamentos 
            ORDER BY RAND() 
            LIMIT 1
        `)
        if (!departamento.length) {
            throw new Error('No se encontraron departamentos.')
        }

        // Extraer el primer departamento obtenido
        const departamentoSeleccionado = departamento[0]

        // Paso 2: Obtener una provincia aleatoria dentro del departamento seleccionado
        const [provincia] = await db.promise().query(
            `
            SELECT * FROM provincias
            WHERE departamento_id = ? 
            ORDER BY RAND() 
            LIMIT 1
        `,
            [departamentoSeleccionado.id]
        )
        if (!provincia.length) {
            throw new Error(
                `No se encontraron provincias para el departamento ${departamentoSeleccionado.id}.`
            )
        }

        // Extraer la primera provincia obtenida
        const provinciaSeleccionada = provincia[0]

        // Paso 3: Obtener un distrito aleatorio dentro de la provincia seleccionada
        const [distrito] = await db.promise().query(
            `
            SELECT * FROM distritos 
            WHERE provincia_id = ? 
            ORDER BY RAND() 
            LIMIT 1
        `,
            [provinciaSeleccionada.id]
        )
        if (!distrito.length) {
            throw new Error(
                `No se encontraron distritos para la provincia ${provinciaSeleccionada.id}.`
            )
        }

        // Extraer el primer distrito obtenido
        const distritoSeleccionado = distrito[0]

        // Retornar los resultados
        return {
            departamento: departamentoSeleccionado,
            provincia: provinciaSeleccionada,
            distrito: distritoSeleccionado
        }
    } catch (error) {
        console.error('Error obteniendo la ubicación aleatoria:', error.message)
        throw error
    }
}

const generarNumeroAleatorio = () => {
    return Math.floor(Math.random() * 2500) + 1000 // Genera un número aleatorio entre 1000 y 9999
}

const generarFechaAleatoria = () => {
    // Año fijo en 2024
    const anio = 2024

    // Genera un mes aleatorio entre 0 y 11 (0 = enero, 11 = diciembre)
    const mes = Math.floor(Math.random() * 12)

    // Genera un día aleatorio válido para el mes y año seleccionados
    const diasPorMes = [
        31,
        anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ]
    const dia = Math.floor(Math.random() * diasPorMes[mes]) + 1

    // Crea un objeto Date con la fecha aleatoria en 2024
    const fecha = new Date(anio, mes, dia)

    return fecha
}

const generarCorreoAleatorio = () => {
    const caracteres = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let nombreUsuario = ''
    for (let i = 0; i < 8; i++) {
        // Puedes cambiar el 8 por la longitud que desees para el nombre de usuario
        nombreUsuario += caracteres.charAt(
            Math.floor(Math.random() * caracteres.length)
        )
    }

    const dominio = 'example.com' // Puedes cambiar esto por el dominio que prefieras
    return `${nombreUsuario}@${dominio}`
}

const CATEGORIAS_DISPONIBLES = () => {
    const opciones = [
        'Programador/a Web',
        'Diseñador/a Gráfico',
        'Ingeniero/a de Software',
        'Desarrollador/a Frontend',
        'Desarrollador/a Backend',
        'Administrador/a de Redes',
        'Consultor/a de Marketing Digital',
        'Gestor/a de Proyectos',
        'Analista de Datos',
        'Community Manager',
        'Especialista en SEO',
        'Diseñador/a UX/UI',
        'Arquitecto/a',
        'Abogado/a',
        'Contador/a',
        'Médico/a',
        'Enfermero/a',
        'Psicólogo/a',
        'Profesor/a de Matemáticas',
        'Arquitecto/a de Sistemas'
    ]

    return opciones
}

const categoriasExisten = async () => {
    return new Promise((resolve, reject) => {
        db.query('SELECT COUNT(*) as count FROM categories', (err, results) => {
            if (err) reject(err)
            else resolve(results[0].count > 0)
        })
    })
}

const insertarCategorias = async () => {
    const yaExisten = await categoriasExisten()
    if (yaExisten) {
        console.log('Las categorías ya existen en la base de datos')
        return
    }

    const fecha_hoy = moment().format('YYYY-MM-DD HH:mm:ss')
    const categorias = CATEGORIAS_DISPONIBLES()

    const insertPromises = categorias.map(nombre => {
        const slug = nombre
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/\/a/g, '')

        return new Promise((resolve, reject) => {
            db.query(
                `INSERT IGNORE INTO categories 
                 (name, slug, user_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [nombre, slug, 2, fecha_hoy, fecha_hoy],
                (err, results) => {
                    if (err) reject(err)
                    else resolve(results)
                }
            )
        })
    })

    await Promise.all(insertPromises)
    console.log('Categorías insertadas correctamente')
}

const getRandomCategoryId = () => {
    return new Promise((resolve, reject) => {
        db.query(
            'SELECT id FROM categories ORDER BY RAND() LIMIT 1',
            (err, results) => {
                if (err) reject(err)
                else resolve(results[0].id)
            }
        )
    })
}

const insertDataIntoDB = async data => {
    try {
        await ensureDbConnection()
        await insertarCategorias()
        const insertPromises = data.map(async row => {
            try {
                // Validar datos requeridos
                if (!row.nombreempresa || !row.ruc) {
                    console.warn(
                        'Fila omitida: falta nombre de empresa o RUC',
                        row
                    )
                    return null
                }

                // 1. Verificar si la empresa ya existe
                const empresaExistenteId = await checkEmpresaExistente(
                    row.nombreempresa,
                    row.ruc
                )
                let empresaId
                let empresaExistente = false

                if (empresaExistenteId) {
                    // Usar la empresa existente
                    empresaId = empresaExistenteId
                    empresaExistente = true
                    console.log(`Usando empresa existente ID: ${empresaId}`)
                } else {
                    // Insertar nueva empresa
                    const location = await getRandomLocation()
                    empresaId = await new Promise((resolve, reject) => {
                        const queryEmpresa = `
                            INSERT INTO empresas 
                            (ra_social, ruc, direccion, telefono, correo, user_id, created_at, updated_at, creado)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `
                        const empresaValues = [
                            limpiarRazonSocial(row.nombreempresa), // Nombre normalizado
                            row.ruc.toString().trim(),
                            `${location.distrito.name}, ${location.provincia.name}, ${location.departamento.name}`,
                            row.telefono
                                ? row.telefono.toString().trim()
                                : null,
                            row.correo
                                ? row.correo.toString().trim().toLowerCase()
                                : null,
                            row.user_id,
                            row.created_at,
                            row.updated_at,
                            row.creado
                        ]

                        db.query(
                            queryEmpresa,
                            empresaValues,
                            (err, results) => {
                                if (err) {
                                    // Manejar error de duplicado (por si acaso)
                                    if (err.code === 'ER_DUP_ENTRY') {
                                        console.log(
                                            'Empresa ya existe, recuperando ID...'
                                        )
                                        // Intentar recuperar el ID existente
                                        checkEmpresaExistente(
                                            row.nombreempresa,
                                            row.ruc
                                        )
                                            .then(id => resolve(id))
                                            .catch(e => reject(e))
                                    } else {
                                        reject(err)
                                    }
                                } else {
                                    resolve(results.insertId)
                                }
                            }
                        )
                    })
                    console.log(`Nueva empresa insertada ID: ${empresaId}`)
                }

                const categoriaId = await getRandomCategoryId()

                // 3. Insertar oferta laboral (siempre nueva)
                const location = await getRandomLocation()
                const ofertaId = await new Promise((resolve, reject) => {
                    const queryOferta = `
                        INSERT INTO oferta_laborals 
                        (titulo, departamento_id, provincia_id, distrito_id, remuneracion, 
                         descripcion, body, fecha_inicio, fecha_fin, state, limite_postulante, 
                         empresa_id, category_id, user_id, created_at, updated_at, creado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `
                    const ofertaValues = [
                        row.titulo,
                        location.departamento.id,
                        location.provincia.id,
                        location.distrito.id,
                        row.remuneracion,
                        row.descripcion,
                        row.body,
                        row.fecha_inicio,
                        row.fecha_fin,
                        row.state,
                        row.limite_postulante,
                        empresaId,
                        categoriaId,
                        row.user_id,
                        row.created_at,
                        row.updated_at,
                        row.creado
                    ]

                    db.query(queryOferta, ofertaValues, (err, results) => {
                        if (err) reject(err)
                        else resolve(results.insertId)
                    })
                })

                return { ofertaId, empresaId, empresaExistente }
            } catch (err) {
                console.error('Error al procesar una fila:', err)
                throw err
            }
        })

        const results = await Promise.all(insertPromises)
        console.log('Inserción completada:', results)
        return results
    } catch (err) {
        console.error('Error en insertDataIntoDB:', err)
        throw err
    }
}

const processPage = async (page, url) => {
    console.log('Visitando página ==>', url)
    await page.goto(url, { waitUntil: 'networkidle2' })

    // Selecciona el contenedor principal primero
    const gridSelector = '.parrilla_oferta'

    try {
        await page.waitForSelector(gridSelector, { timeout: 5000 })
    } catch (error) {
        console.log(
            `No se encontraron resultados en la página ${url}. Deteniendo...`
        )
        return false
    }

    // Ahora selecciona TODOS los artículos de ofertas dentro del contenedor
    const listaDeItems = await page.$$(`${gridSelector} article.box_offer`)

    console.log(`Encontradas ${listaDeItems.length} ofertas en la página`)

    let pageData = []

    // Función para obtener la fecha actual en formato timestamp
    const fecha_hoy = () => {
        return moment().format('YYYY-MM-DD HH:mm:ss')
    }

    const fecha_requerida = fecha_hoy() // Llama a la función para obtener la fecha actual

    for (const item of listaDeItems) {
        try {
            console.log('Procesando item...', item) // Para saber si entra al ciclo.

            //empresa
            const nombreempresa = await item.$('p a')
            const ruc = await generarRucUnico()
            const telefono = await item.$('.ss')
            // const direccion = await item.$(".sc-fPEBxH h3");
            const correo = generarCorreoAleatorio()
            //end empresa

            //oferta
            const titulo = await item.$('h2 a')
            const remuneracion = generarNumeroAleatorio()
            const descripcion = await item.$('h2 a')
            const body = await item.$('.sc-kIXKos p')
            const fecha_inicio = await item.$('.ss')
            const fecha_fin = await item.$('.ss')
            const state = await item.$('.ss')
            const limite_postulante = await item.$('.ss')
            //end oferta

            //campo por defecto
            const user_id = await item.$('.ss')
            const created_at = fecha_requerida
            const updated_at = fecha_requerida
            const image = await item.$('.sc-kQZOhr img')
            const creado = generarFechaAleatoria()
            // end campo por efecto
            // Nuevos campos

            //empresa
            const getNombreempresa = await page.evaluate(
                el => (el ? el.innerText : 'N/A'),
                nombreempresa
            )

            // const getDireccion = await page.evaluate(el => el ? el.innerText : '74321221', direccion);
            const getTelefono = await page.evaluate(
                el => (el ? el.innerText : '916545454'),
                telefono
            )
            // const getCorreo = await page.evaluate(el => el ? el.innerText : 'empresa@gmail.com', correo);
            //end empresa

            // oferta
            const getTitulo = await page.evaluate(
                el => (el ? el.innerText : 'N/A'),
                titulo
            )
            // const getRemuneracion = await page.evaluate(el => el ? el.innerText : 's/. 2500', remuneracion);
            const getDescripcion = await page.evaluate(
                el => (el ? el.innerText : 'N/A'),
                descripcion
            )
            const getBody = await page.evaluate(
                el => (el ? el.innerText : 'N/A'),
                body
            )
            const getFechaInicio = convertirFecha(
                await page.evaluate(
                    el => (el ? el.innerText : '02-09-2024'),
                    fecha_inicio
                )
            )
            const getFechaFin = convertirFecha(
                await page.evaluate(
                    el => (el ? el.innerText : '15-09-2024'),
                    fecha_fin
                )
            )
            const getState = await page.evaluate(
                el => (el ? el.innerText : '2'),
                state
            )
            const getLimitePostulante = await page.evaluate(
                el => (el ? el.innerText : 'N/A'),
                limite_postulante
            )
            //end oferta

            // campos clasicos
            const getImage = await page.evaluate(
                el => (el ? el.getAttribute('src') : 'N/A'),
                image
            )
            const getUserId = await page.evaluate(
                el => (el ? el.innerText : '2'),
                user_id
            )

            // end campos clasicos

            if (!ruc) {
                console.error('No se pudo generar un RUC válido')
                continue // Saltar esta iteración
            }

            pageData.push({
                //empresa
                nombreempresa: getNombreempresa,
                ruc: ruc,
                // direccion: getDireccion,
                telefono: getTelefono,
                correo: correo,
                //end empresa

                //oferta
                titulo: getTitulo,
                remuneracion: remuneracion,
                descripcion: getDescripcion,
                body: getBody,
                fecha_inicio: getFechaInicio,
                fecha_fin: getFechaFin,
                state: getState,
                limite_postulante: getLimitePostulante,
                //end oferta

                //campos especiales
                image: getImage,
                user_id: getUserId,
                created_at: created_at,
                updated_at: updated_at,
                creado: creado
                // end campos especiales
            })
        } catch (error) {
            console.error('Error procesando item:', error)
        }
    }

    await insertDataIntoDB(pageData)
    console.log(`Datos de la página ${url} insertados en la base de datos.`)

    await delay(2000)

    return !cancelScraping // Si se canceló, no hay más páginas
}

app.post('/start-scraping', async (req, res) => {
    const { link_web } = req.body

    console.log('Enlace recibido:', link_web)

    if (
        !link_web ||
        !link_web.startsWith(
            'https://pe.computrabajo.com/empleos-en-puno-en-juliaca'
        )
    ) {
        return res.status(400).send('Link incorrecto')
    }

    if (scrapingProcess) {
        return res.status(400).send('El scraping ya está en curso.')
    }

    cancelScraping = false
    scrapingProcess = (async () => {
        await ensureDbConnection() // Asegura la conexión antes de iniciar el scraping

        const browser = await puppeteer.launch({
            headless: true,
            ignoreHTTPSErrors: true
        })

        const page = await browser.newPage()
        const header = randomUseragent.getRandom(
            ua => ua.browserName === 'Firefox'
        )
        await page.setUserAgent(header)
        await page.setViewport({ width: 1920, height: 1080 })

        let pageNumber = 1
        let hasMorePages = true

        while (hasMorePages && !cancelScraping) {
            const currentUrl = `${link_web}?p=${pageNumber}`
            console.log('URL actual:', currentUrl)
            hasMorePages = await processPage(page, currentUrl)

            if (hasMorePages) {
                pageNumber++
            } else {
                console.log('No se encontraron más páginas para procesar.')
            }
        }

        await page.close()
        await browser.close()
        //   db.end();

        scrapingProcess = null // Restablece el estado del proceso
        return 'Scraping completado'
    })()

    const result = await scrapingProcess
    res.send(result)
})

app.post('/stop-scraping', (req, res) => {
    if (scrapingProcess) {
        cancelScraping = true
        res.send('Scraping detenido')
    } else {
        res.status(400).send('No hay proceso de scraping en curso')
    }
})

app.post('/shutdown-server', (req, res) => {
    res.send('Servidor apagándose...')
    process.exit(0) // Apaga el servidor
})

app.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000')
})

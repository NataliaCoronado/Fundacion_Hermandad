"use strict";
module.exports = {
  async eliminarProfesional(id) {
    try {
      await this.db.tx(async (q) => {
        await q("DELETE FROM agenda WHERE id_profesional=$1 RETURNING id_agenda", [Number(id)]);
        await q("DELETE FROM bloqueo WHERE id_profesional=$1 RETURNING id_bloqueo", [Number(id)]);
        const r = await q("DELETE FROM profesional WHERE id_profesional=$1 RETURNING id_profesional", [Number(id)]);
        if (!r.length) throw new Error("PROFESIONAL_NO_ENCONTRADO");
      });
    } catch (e) {
      if (["23503", "23001"].includes(e.code) || /foreign key constraint/.test(e.message)) throw new Error("El integrante tiene historial; desactívalo en vez de eliminarlo.");
      throw e;
    }
  },
  async conBloquesAtomicos(fn) {
    return this.db.tx(async q => {
      const repo=Object.create(this); repo.db={query:q,tx:async fn=>fn(q)};
      repo.bloque=id=>require('./RepositorioCatalogoPostgreSQL').RepositorioCatalogoPostgreSQL.prototype.bloque.call(repo,id);
      return fn(repo);
    });
  },
  async actualizarBloque(id, d) {
    return this.db.tx(async (q) => {
      const [a] = await q(
        `INSERT INTO agenda(id_profesional,id_policlinico,id_especialidad,vigente_desde,vigente_hasta,hora_inicio,hora_termino,duracion_min,estado_publicacion,creado_por)
 SELECT a.id_profesional,COALESCE($2::smallint,a.id_policlinico),a.id_especialidad,COALESCE($3::date,b.fecha),COALESCE($3::date,b.fecha),COALESCE($4::time,b.hora_inicio),COALESCE($4::time,b.hora_inicio)+make_interval(mins=>a.duracion_min::int),a.duracion_min,a.estado_publicacion,a.creado_por FROM agenda a JOIN bloque_horario b ON a.id_agenda=b.id_agenda WHERE b.id_bloque=$1 RETURNING id_agenda AS id`,
        [id, d.idPoliclinico || null, d.fecha || null, d.hora || null],
      );
      await q(
        "UPDATE bloque_horario SET id_agenda=$2,fecha=COALESCE($3::date,fecha),hora_inicio=COALESCE($4::time,hora_inicio),hora_termino=COALESCE($4::time,hora_inicio)+(hora_termino-hora_inicio) WHERE id_bloque=$1 RETURNING id_bloque",
        [id, a.id, d.fecha || null, d.hora || null],
      );
    });
  },
  async guardarEquipo(d) {
    return this.db.tx(async (q) => {
      let id = d.id;
      const [nombre, ...resto] = d.nombre.trim().split(/\s+/);
      if (id)
        await q(
          "UPDATE profesional SET nombres=$2,apellidos=$3 WHERE id_profesional=$1 RETURNING id_profesional",
          [id, nombre, resto.join(" ")],
        );
      else {
        if (!require("../herramientas/rut").rutValido(d.rut))
          throw new Error("RUT profesional inválido.");
        const [p] = await q(
          "INSERT INTO profesional(rut,nombres,apellidos,correo_institucional) VALUES($1,$2,$3,$4) RETURNING id_profesional::int AS id",
          [d.rut, nombre, resto.join(" "), d.correo],
        );
        id = p.id;
      }
      for (const sede of d.lugares)
        for (const esp of d.especialidades) {
          const [e] = await q(
            "SELECT id_especialidad AS id FROM especialidad WHERE nombre=$1",
            [esp],
          );
          if (!e) throw new Error("Especialidad inválida.");
          await q(
            "INSERT INTO policlinico_especialidad(id_policlinico,id_especialidad) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id_policlinico",
            [sede, e.id],
          );
          await q(
            "INSERT INTO profesional_asignacion(id_profesional,id_policlinico,id_especialidad) VALUES($1,$2,$3) ON CONFLICT(id_profesional,id_policlinico,id_especialidad) DO UPDATE SET activo=TRUE RETURNING id_profesional",
            [id, sede, e.id],
          );
        }
      return { id };
    });
  },
  async guardarLugar(d) {
    let id = d.id;
    if (id)
      await this.db.query(
        "UPDATE policlinico SET nombre=$2,direccion=$3,activo=$4 WHERE id_policlinico=$1 RETURNING id_policlinico",
        [id, d.nombre, d.direccion || null, d.activo],
      );
    else {
      const [p] = await this.db.query(
        "INSERT INTO policlinico(nombre,direccion,id_comuna,correo,whatsapp,es_telemedicina) VALUES($1,$2,$3,$4,$5,$6) RETURNING id_policlinico::int AS id",
        [
          d.nombre,
          d.direccion || null,
          d.telemedicina ? null : Number(d.idComuna),
          d.correo,
          d.whatsapp,
          d.telemedicina,
        ],
      );
      id = p.id;
    }
    return { ...d, id: Number(id) };
  },
  async guardarEspecialidad(d) {
    await this.db.query(
      "INSERT INTO especialidad(nombre,activo) VALUES($1,$2) ON CONFLICT(nombre) DO UPDATE SET activo=EXCLUDED.activo RETURNING id_especialidad",
      [d.nombre, d.activo],
    );
    return d;
  },
  async guardarUsuario(d) {
    const [nombre, ...resto] = d.nombre.trim().split(/\s+/);
    let id = d.id;
    if (id)
      await this.db.query(
        "UPDATE usuario SET nombres=$2,apellidos=$3,correo=$4,id_rol=(SELECT id_rol FROM rol WHERE codigo=$5),id_policlinico=$6,activo=$7 WHERE id_usuario=$1::uuid RETURNING id_usuario",
        [
          id,
          nombre,
          resto.join(" "),
          d.correo,
          d.rol,
          d.idPoliclinico,
          d.activo,
        ],
      );
    else {
      const [u] = await this.db.query(
        "INSERT INTO usuario(nombres,apellidos,correo,id_rol,id_policlinico,activo) SELECT $1,$2,$3,id_rol,$5,$6 FROM rol WHERE codigo=$4 RETURNING id_usuario::text AS id",
        [nombre, resto.join(" "), d.correo, d.rol, d.idPoliclinico, d.activo],
      );
      id = u.id;
    }
    return {
      id,
      nombre: d.nombre,
      correo: d.correo,
      rol: d.rol,
      idPoliclinico: d.idPoliclinico,
      activo: d.activo,
    };
  },
};

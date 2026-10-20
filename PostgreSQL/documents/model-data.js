// Documento JSON da modelagem. Carregado antes de script.js, inclusive via file://.
// Manter como texto: não transformar as propriedades em código executável.
const OLIUS_MODEL_JSON = `
{
  "tables": {
    "users": {
      "name": "users",
      "domain": "cadastros",
      "description": "Usuários autenticados. Driver não possui login. Inativar para preservar histórico.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "character varying(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "name character varying(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "email",
          "type": "character varying(255)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "email character varying(255) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "password_hash",
          "type": "character varying(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "password_hash character varying(255) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "user_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "user_type user_type_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "status",
          "type": "active_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'::active_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "users_email_key",
          "columns": [
            "email"
          ]
        },
        {
          "name": "uq_users_id_type",
          "columns": [
            "id",
            "user_type"
          ]
        }
      ],
      "fks": [],
      "special": [
        "ck_users_name_not_blank: CHECK ((btrim((name)::text) <> ''::text))",
        "ck_users_email: CHECK (((btrim((email)::text) <> ''::text) AND (POSITION(('@'::text) IN (email)) > 1)))",
        "ck_users_password_not_blank: CHECK ((btrim((password_hash)::text) <> ''::text))",
        "ck_users_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))"
      ],
      "main": [
        "id",
        "name",
        "email",
        "user_type",
        "status"
      ]
    },
    "establishment_type": {
      "name": "establishment_type",
      "domain": "cadastros",
      "description": "Catálogo de tipos de estabelecimento.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "character varying(100)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "name character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "character varying(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "description character varying(255)",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "establishment_type_name_key",
          "columns": [
            "name"
          ]
        }
      ],
      "fks": [],
      "special": [
        "ck_establishment_type_name_not_blank: CHECK ((btrim((name)::text) <> ''::text))"
      ],
      "main": [
        "id",
        "name"
      ]
    },
    "addresses": {
      "name": "addresses",
      "domain": "cadastros",
      "description": "Registro próprio por estabelecimento ou PEV; conteúdo textual pode se repetir.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "owner_kind",
          "type": "address_owner_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "owner_kind address_owner_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "state",
          "type": "character(2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "state character(2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "city",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "city character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "neighborhood",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "neighborhood character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "street",
          "type": "character varying(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "street character varying(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "number",
          "type": "character varying(20)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "number character varying(20) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "cep",
          "type": "character(8)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cep character(8) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "complement",
          "type": "character varying(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "complement character varying(150)",
          "description": "",
          "fk": []
        },
        {
          "name": "latitude",
          "type": "numeric(9,6)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "latitude numeric(9,6)",
          "description": "",
          "fk": []
        },
        {
          "name": "longitude",
          "type": "numeric(9,6)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "longitude numeric(9,6)",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_addresses_owner",
          "columns": [
            "id",
            "owner_kind"
          ]
        }
      ],
      "fks": [],
      "special": [
        "ck_addresses_state: CHECK ((state ~ '^[A-Z]{2}$'::text))",
        "ck_addresses_cep: CHECK ((cep ~ '^[0-9]{8}$'::text))",
        "ck_addresses_city: CHECK ((btrim((city)::text) <> ''::text))",
        "ck_addresses_neighborhood: CHECK ((btrim((neighborhood)::text) <> ''::text))",
        "ck_addresses_street: CHECK ((btrim((street)::text) <> ''::text))",
        "ck_addresses_number: CHECK ((btrim((number)::text) <> ''::text))",
        "ck_addresses_latitude: CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric))))",
        "ck_addresses_longitude: CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric))))"
      ],
      "main": [
        "id",
        "owner_kind",
        "city",
        "street",
        "number",
        "cep"
      ]
    },
    "telephone": {
      "name": "telephone",
      "domain": "cadastros",
      "description": "Um número pode pertencer a vários usuários, sem repetição para o mesmo usuário.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "telephone",
          "type": "character varying(20)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "telephone character varying(20) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "user_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "user_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_telephone_user"
          ]
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_telephone_user_number",
          "columns": [
            "user_id",
            "telephone"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_telephone_user",
          "child": "telephone",
          "parent": "users",
          "columns": [
            "user_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_telephone_length: CHECK (((length((telephone)::text) >= 10) AND (length((telephone)::text) <= 15)))"
      ],
      "main": [
        "id",
        "user_id",
        "telephone"
      ]
    },
    "user_qr_code": {
      "name": "user_qr_code",
      "domain": "cadastros",
      "description": "Registro central do token vigente. Unicidade global B2C/B2B; sem histórico do conteúdo dos tokens.",
      "columns": [
        {
          "name": "user_id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "user_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_user_qr_type"
          ]
        },
        {
          "name": "qr_token",
          "type": "character varying(64)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "qr_token character varying(64) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "user_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "user_type user_type_t NOT NULL",
          "description": "",
          "fk": [
            "fk_user_qr_type"
          ]
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "user_id"
      ],
      "uniques": [
        {
          "name": "user_qr_code_qr_token_key",
          "columns": [
            "qr_token"
          ]
        },
        {
          "name": "uq_user_qr_owner_token",
          "columns": [
            "user_id",
            "qr_token"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_user_qr_type",
          "child": "user_qr_code",
          "parent": "users",
          "columns": [
            "user_id",
            "user_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        }
      ],
      "special": [
        "ck_user_qr_code_type: CHECK ((user_type = ANY (ARRAY['CITIZENS'::user_type_t, 'ESTABLISHMENT'::user_type_t])))",
        "ck_user_qr_code_token: CHECK ((btrim((qr_token)::text) <> ''::text))"
      ],
      "main": [
        "user_id",
        "qr_token",
        "user_type"
      ]
    },
    "citizens": {
      "name": "citizens",
      "domain": "cadastros",
      "description": "Especialização de users. Saldo derivado das revisões de pontos; atualização somente pelas rotinas.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_citizens_user_type",
            "fk_citizens_qr"
          ]
        },
        {
          "name": "cpf",
          "type": "character(11)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cpf character(11) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "user_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'CITIZENS'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "user_type user_type_t GENERATED ALWAYS AS ('CITIZENS'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_citizens_user_type"
          ]
        },
        {
          "name": "qr_token",
          "type": "character varying(64)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "qr_token character varying(64) NOT NULL",
          "description": "",
          "fk": [
            "fk_citizens_qr"
          ]
        },
        {
          "name": "points",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "points bigint NOT NULL DEFAULT 0",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "citizens_cpf_key",
          "columns": [
            "cpf"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_citizens_user_type",
          "child": "citizens",
          "parent": "users",
          "columns": [
            "id",
            "user_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_citizens_qr",
          "child": "citizens",
          "parent": "user_qr_code",
          "columns": [
            "id",
            "qr_token"
          ],
          "references": [
            "user_id",
            "qr_token"
          ],
          "actions": "ON UPDATE CASCADE ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        }
      ],
      "special": [
        "ck_citizens_cpf: CHECK ((length(cpf) = 11))",
        "ck_citizens_points: CHECK ((points >= 0))"
      ],
      "main": [
        "id",
        "cpf",
        "user_type",
        "qr_token",
        "points"
      ]
    },
    "establishment": {
      "name": "establishment",
      "domain": "cadastros",
      "description": "Especialização de users. Saldo derivado das revisões de pontos; atualização somente pelas rotinas.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_establishment_user_type",
            "fk_establishment_qr"
          ]
        },
        {
          "name": "cnpj",
          "type": "character(14)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cnpj character(14) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "user_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'ESTABLISHMENT'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "user_type user_type_t GENERATED ALWAYS AS ('ESTABLISHMENT'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_establishment_user_type"
          ]
        },
        {
          "name": "qr_token",
          "type": "character varying(64)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "qr_token character varying(64) NOT NULL",
          "description": "",
          "fk": [
            "fk_establishment_qr"
          ]
        },
        {
          "name": "points",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "points bigint NOT NULL DEFAULT 0",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "description text",
          "description": "",
          "fk": []
        },
        {
          "name": "is_pev",
          "type": "boolean",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "is_pev boolean NOT NULL DEFAULT false",
          "description": "Derivado do PEV APPROVED; sincronizar na mesma transação, sem edição independente.",
          "fk": []
        },
        {
          "name": "type_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "type_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_establishment_type"
          ]
        },
        {
          "name": "address_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "address_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_establishment_address"
          ]
        },
        {
          "name": "address_kind",
          "type": "address_owner_t",
          "pk": false,
          "unique": false,
          "generated": "'ESTABLISHMENT'::address_owner_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "address_kind address_owner_t GENERATED ALWAYS AS ('ESTABLISHMENT'::address_owner_t) STORED",
          "description": "",
          "fk": [
            "fk_establishment_address"
          ]
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "establishment_cnpj_key",
          "columns": [
            "cnpj"
          ]
        },
        {
          "name": "establishment_address_id_key",
          "columns": [
            "address_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_establishment_user_type",
          "child": "establishment",
          "parent": "users",
          "columns": [
            "id",
            "user_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_establishment_qr",
          "child": "establishment",
          "parent": "user_qr_code",
          "columns": [
            "id",
            "qr_token"
          ],
          "references": [
            "user_id",
            "qr_token"
          ],
          "actions": "ON UPDATE CASCADE ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_establishment_type",
          "child": "establishment",
          "parent": "establishment_type",
          "columns": [
            "type_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_establishment_address",
          "child": "establishment",
          "parent": "addresses",
          "columns": [
            "address_id",
            "address_kind"
          ],
          "references": [
            "id",
            "owner_kind"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        }
      ],
      "special": [
        "ck_establishment_cnpj: CHECK ((length(cnpj) = 14))",
        "ck_establishment_points: CHECK ((points >= 0))"
      ],
      "main": [
        "id",
        "cnpj",
        "type_id",
        "address_id",
        "qr_token",
        "is_pev",
        "points"
      ]
    },
    "driver": {
      "name": "driver",
      "domain": "b2b",
      "description": "Participante operacional cadastrado; não equivale a usuário autenticado.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "character varying(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "name character varying(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "cpf",
          "type": "character(11)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cpf character(11) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "cnh",
          "type": "character(11)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cnh character(11) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "registration_date",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "registration_date timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "status",
          "type": "active_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'::active_status_t",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "driver_cpf_key",
          "columns": [
            "cpf"
          ]
        },
        {
          "name": "driver_cnh_key",
          "columns": [
            "cnh"
          ]
        }
      ],
      "fks": [],
      "special": [
        "ck_driver_name_not_blank: CHECK ((btrim((name)::text) <> ''::text))",
        "ck_driver_documents: CHECK (((length(cpf) = 11) AND (length(cnh) = 11)))",
        "ck_driver_dates: CHECK ((isfinite(registration_date) AND isfinite(updated_at) AND (updated_at >= registration_date)))"
      ],
      "main": [
        "id",
        "name",
        "cpf",
        "cnh",
        "status"
      ]
    },
    "pev": {
      "name": "pev",
      "domain": "b2c",
      "description": "Exatamente um responsável. Inativação preserva aprovação. Sincronizar is_pev na mesma transação.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "status",
          "type": "approval_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status approval_status_t NOT NULL DEFAULT 'PENDING'::approval_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "approved_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "approved_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "approved_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "approved_by uuid",
          "description": "",
          "fk": [
            "fk_pev_admin"
          ]
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'ADMIN'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_pev_admin"
          ]
        },
        {
          "name": "citizen_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "citizen_id uuid",
          "description": "",
          "fk": [
            "fk_pev_citizen"
          ]
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "establishment_id uuid",
          "description": "",
          "fk": [
            "fk_pev_establishment"
          ]
        },
        {
          "name": "address_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "address_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_pev_address"
          ]
        },
        {
          "name": "address_kind",
          "type": "address_owner_t",
          "pk": false,
          "unique": false,
          "generated": "'PEV'::address_owner_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "address_kind address_owner_t GENERATED ALWAYS AS ('PEV'::address_owner_t) STORED",
          "description": "",
          "fk": [
            "fk_pev_address"
          ]
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "pev_citizen_id_key",
          "columns": [
            "citizen_id"
          ]
        },
        {
          "name": "pev_establishment_id_key",
          "columns": [
            "establishment_id"
          ]
        },
        {
          "name": "pev_address_id_key",
          "columns": [
            "address_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_pev_citizen",
          "child": "pev",
          "parent": "citizens",
          "columns": [
            "citizen_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..1"
        },
        {
          "name": "fk_pev_establishment",
          "child": "pev",
          "parent": "establishment",
          "columns": [
            "establishment_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..1"
        },
        {
          "name": "fk_pev_address",
          "child": "pev",
          "parent": "addresses",
          "columns": [
            "address_id",
            "address_kind"
          ],
          "references": [
            "id",
            "owner_kind"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_pev_admin",
          "child": "pev",
          "parent": "users",
          "columns": [
            "approved_by",
            "admin_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_pev_single_owner: CHECK (((citizen_id IS NOT NULL) <> (establishment_id IS NOT NULL)))",
        "ck_pev_approval: CHECK ((((approved_at IS NULL) = (approved_by IS NULL)) AND ((status <> 'APPROVED'::approval_status_t) OR (approved_at IS NOT NULL)) AND ((approved_at IS NULL) OR (isfinite(approved_at) AND (approved_at >= created_at)))))",
        "ck_pev_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))"
      ],
      "main": [
        "id",
        "citizen_id",
        "establishment_id",
        "address_id",
        "status",
        "approved_by"
      ]
    },
    "subscription_plan": {
      "name": "subscription_plan",
      "domain": "planos",
      "description": "Catálogo comercial. Cobranças e ciclos mantêm cópias das condições contratadas.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "character varying(100)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "name character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "description text",
          "description": "",
          "fk": []
        },
        {
          "name": "monthly_price",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "monthly_price numeric(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "volume_limit_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "volume_limit_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_limit",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "collection_limit integer NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "status",
          "type": "active_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'::active_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "subscription_plan_name_key",
          "columns": [
            "name"
          ]
        }
      ],
      "fks": [],
      "special": [
        "ck_subscription_plan_name_not_blank: CHECK ((btrim((name)::text) <> ''::text))",
        "ck_subscription_plan_price: CHECK (((monthly_price > (0)::numeric) AND (monthly_price <> 'NaN'::numeric)))",
        "ck_subscription_plan_volume: CHECK (((volume_limit_liters > (0)::numeric) AND (volume_limit_liters <> 'NaN'::numeric)))",
        "ck_subscription_plan_slots: CHECK ((collection_limit > 0))",
        "ck_subscription_plan_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))"
      ],
      "main": [
        "id",
        "name",
        "monthly_price",
        "volume_limit_liters",
        "collection_limit",
        "status"
      ]
    },
    "establishment_subscription": {
      "name": "establishment_subscription",
      "domain": "planos",
      "description": "Vínculo contratual. Status ACTIVE não substitui a verificação do intervalo do ciclo pago.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_subscription_establishment"
          ]
        },
        {
          "name": "status",
          "type": "subscription_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status subscription_status_t NOT NULL DEFAULT 'PENDING'::subscription_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "activated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "activated_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "inactivated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "inactivated_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_subscription_owner",
          "columns": [
            "id",
            "establishment_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_subscription_establishment",
          "child": "establishment_subscription",
          "parent": "establishment",
          "columns": [
            "establishment_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_establishment_subscription_activation: CHECK ((((status <> 'ACTIVE'::subscription_status_t) OR (activated_at IS NOT NULL)) AND ((status <> 'INACTIVE'::subscription_status_t) OR (inactivated_at IS NOT NULL)) AND ((activated_at IS NULL) OR (isfinite(activated_at) AND (activated_at >= created_at))) AND ((inactivated_at IS NULL) OR (isfinite(inactivated_at) AND (inactivated_at >= created_at)))))",
        "ck_establishment_subscription_status_dates: CHECK ((((status <> 'ACTIVE'::subscription_status_t) OR (inactivated_at IS NULL)) AND ((status <> 'PENDING'::subscription_status_t) OR ((activated_at IS NULL) AND (inactivated_at IS NULL))) AND ((activated_at IS NULL) OR (inactivated_at IS NULL) OR (inactivated_at >= activated_at))))",
        "ck_establishment_subscription_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))",
        "CREATE UNIQUE INDEX uq_subscription_active ON public.establishment_subscription USING btree (establishment_id) WHERE (status = 'ACTIVE'::subscription_status_t)"
      ],
      "main": [
        "id",
        "establishment_id",
        "status",
        "activated_at"
      ]
    },
    "subscription_cycle": {
      "name": "subscription_cycle",
      "domain": "planos",
      "description": "Período pago [início,fim). Limites vigentes substituídos no upgrade. Sem contadores duplicados de consumo.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "subscription_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "subscription_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_subscription_owner"
          ]
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_subscription_owner"
          ]
        },
        {
          "name": "cycle_number",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cycle_number integer NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "starts_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "starts_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "ends_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "ends_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "anchor_day",
          "type": "smallint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "anchor_day smallint NOT NULL",
          "description": "Dia original do calendário mensal: 31 pode ajustar para fevereiro sem virar 28 nos meses seguintes.",
          "fk": []
        },
        {
          "name": "anchor_local_time",
          "type": "time without time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "anchor_local_time time without time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "anchor_timezone",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "anchor_timezone character varying(100) NOT NULL",
          "description": "Fuso usado no calendário mensal; TIMESTAMPTZ preserva o instante, não o nome do fuso.",
          "fk": []
        },
        {
          "name": "plan_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "plan_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_plan"
          ]
        },
        {
          "name": "plan_name",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "plan_name character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "plan_description",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "plan_description text",
          "description": "",
          "fk": []
        },
        {
          "name": "monthly_price",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "monthly_price numeric(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "volume_limit_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "volume_limit_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_limit",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "collection_limit integer NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_cycle_number",
          "columns": [
            "subscription_id",
            "cycle_number"
          ]
        },
        {
          "name": "uq_cycle_owner",
          "columns": [
            "id",
            "establishment_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_cycle_subscription_owner",
          "child": "subscription_cycle",
          "parent": "establishment_subscription",
          "columns": [
            "subscription_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_cycle_plan",
          "child": "subscription_cycle",
          "parent": "subscription_plan",
          "columns": [
            "plan_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ex_cycle_no_overlap: EXCLUDE USING gist (establishment_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&)",
        "ck_subscription_cycle_price: CHECK (((monthly_price > (0)::numeric) AND (monthly_price <> 'NaN'::numeric)))",
        "ck_subscription_cycle_volume: CHECK (((volume_limit_liters > (0)::numeric) AND (volume_limit_liters <> 'NaN'::numeric)))",
        "ck_subscription_cycle_slots: CHECK ((collection_limit > 0))",
        "ck_subscription_cycle_period: CHECK ((isfinite(starts_at) AND isfinite(ends_at) AND (ends_at > starts_at)))",
        "ck_subscription_cycle_anchor: CHECK ((((anchor_day >= 1) AND (anchor_day <= 31)) AND (btrim((anchor_timezone)::text) <> ''::text) AND (anchor_local_time < '24:00:00'::time without time zone)))",
        "ck_subscription_cycle_number: CHECK ((cycle_number > 0))",
        "ck_subscription_cycle_plan_name: CHECK ((btrim((plan_name)::text) <> ''::text))",
        "ck_subscription_cycle_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))"
      ],
      "main": [
        "id",
        "subscription_id",
        "establishment_id",
        "plan_id",
        "starts_at",
        "ends_at",
        "volume_limit_liters",
        "collection_limit"
      ]
    },
    "billing_order": {
      "name": "billing_order",
      "domain": "financeiro",
      "description": "Identidade estável do benefício, reutilizada nas reemissões. Não é a cobrança do provedor.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_order_subscription_owner",
            "fk_order_target_cycle",
            "fk_order_previous_cycle"
          ]
        },
        {
          "name": "subscription_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "subscription_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_order_subscription_owner"
          ]
        },
        {
          "name": "purpose",
          "type": "billing_purpose_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "purpose billing_purpose_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "benefit_key",
          "type": "character varying(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "benefit_key character varying(150) NOT NULL",
          "description": "Identidade estável do benefício; reutilizar nas reemissões da cobrança equivalente.",
          "fk": []
        },
        {
          "name": "target_cycle_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "target_cycle_id uuid",
          "description": "",
          "fk": [
            "fk_order_target_cycle"
          ]
        },
        {
          "name": "previous_cycle_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "previous_cycle_id uuid",
          "description": "",
          "fk": [
            "fk_order_previous_cycle"
          ]
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_billing_order_benefit",
          "columns": [
            "establishment_id",
            "benefit_key"
          ]
        },
        {
          "name": "uq_billing_order_owner",
          "columns": [
            "id",
            "establishment_id",
            "purpose"
          ]
        },
        {
          "name": "uq_billing_order_target",
          "columns": [
            "id",
            "target_cycle_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_order_subscription_owner",
          "child": "billing_order",
          "parent": "establishment_subscription",
          "columns": [
            "subscription_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_order_target_cycle",
          "child": "billing_order",
          "parent": "subscription_cycle",
          "columns": [
            "target_cycle_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_order_previous_cycle",
          "child": "billing_order",
          "parent": "subscription_cycle",
          "columns": [
            "previous_cycle_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_billing_order_benefit_key: CHECK ((btrim((benefit_key)::text) <> ''::text))",
        "ck_billing_order_purpose: CHECK ((((purpose = 'INITIAL'::billing_purpose_t) AND (target_cycle_id IS NULL) AND (previous_cycle_id IS NULL)) OR ((purpose = 'RENEWAL'::billing_purpose_t) AND (target_cycle_id IS NULL) AND (previous_cycle_id IS NOT NULL)) OR ((purpose = 'UPGRADE'::billing_purpose_t) AND (target_cycle_id IS NOT NULL) AND (previous_cycle_id IS NULL))))",
        "ck_billing_order_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))",
        "CREATE UNIQUE INDEX uq_order_initial_subscription ON public.billing_order USING btree (subscription_id) WHERE (purpose = 'INITIAL'::billing_purpose_t)",
        "CREATE UNIQUE INDEX uq_order_renewal_previous_cycle ON public.billing_order USING btree (previous_cycle_id) WHERE (purpose = 'RENEWAL'::billing_purpose_t)"
      ],
      "main": [
        "id",
        "subscription_id",
        "establishment_id",
        "purpose",
        "benefit_key",
        "target_cycle_id",
        "previous_cycle_id"
      ]
    },
    "billing_charge": {
      "name": "billing_charge",
      "domain": "financeiro",
      "description": "Tentativa de cobrança com preço e limites congelados. CANCELLATION_PENDING ainda ocupa a vaga de cobrança aberta.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "billing_order_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "billing_order_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_charge_order_owner",
            "fk_charge_order_target"
          ]
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_charge_order_owner",
            "fk_charge_cycle_owner"
          ]
        },
        {
          "name": "purpose",
          "type": "billing_purpose_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "purpose billing_purpose_t NOT NULL",
          "description": "",
          "fk": [
            "fk_charge_order_owner"
          ]
        },
        {
          "name": "target_cycle_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "target_cycle_id uuid",
          "description": "",
          "fk": [
            "fk_charge_order_target",
            "fk_charge_cycle_owner"
          ]
        },
        {
          "name": "provider",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "provider character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "provider_charge_id",
          "type": "character varying(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "provider_charge_id character varying(255)",
          "description": "",
          "fk": []
        },
        {
          "name": "idempotency_key",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "idempotency_key uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "status",
          "type": "charge_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status charge_status_t NOT NULL DEFAULT 'OPEN'::charge_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "plan_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "plan_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_charge_plan"
          ]
        },
        {
          "name": "plan_name",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "plan_name character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "plan_description",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "plan_description text",
          "description": "",
          "fk": []
        },
        {
          "name": "quoted_monthly_price",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "quoted_monthly_price numeric(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "quoted_volume_limit_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "quoted_volume_limit_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "quoted_collection_limit",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "quoted_collection_limit integer NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "from_plan_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "from_plan_id uuid",
          "description": "",
          "fk": [
            "fk_charge_from_plan"
          ]
        },
        {
          "name": "from_monthly_price",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "from_monthly_price numeric(10,2)",
          "description": "",
          "fk": []
        },
        {
          "name": "amount",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "amount numeric(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "currency",
          "type": "character(3)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "currency character(3) NOT NULL DEFAULT 'BRL'::bpchar",
          "description": "",
          "fk": []
        },
        {
          "name": "expires_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "expires_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "closed_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "closed_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "billing_charge_idempotency_key_key",
          "columns": [
            "idempotency_key"
          ]
        },
        {
          "name": "uq_charge_provider",
          "columns": [
            "provider",
            "provider_charge_id"
          ]
        },
        {
          "name": "uq_charge_order",
          "columns": [
            "id",
            "billing_order_id",
            "establishment_id"
          ]
        },
        {
          "name": "uq_charge_provider_identity",
          "columns": [
            "id",
            "provider"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_charge_order_owner",
          "child": "billing_charge",
          "parent": "billing_order",
          "columns": [
            "billing_order_id",
            "establishment_id",
            "purpose"
          ],
          "references": [
            "id",
            "establishment_id",
            "purpose"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_charge_order_target",
          "child": "billing_charge",
          "parent": "billing_order",
          "columns": [
            "billing_order_id",
            "target_cycle_id"
          ],
          "references": [
            "id",
            "target_cycle_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_charge_cycle_owner",
          "child": "billing_charge",
          "parent": "subscription_cycle",
          "columns": [
            "target_cycle_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_charge_plan",
          "child": "billing_charge",
          "parent": "subscription_plan",
          "columns": [
            "plan_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_charge_from_plan",
          "child": "billing_charge",
          "parent": "subscription_plan",
          "columns": [
            "from_plan_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_billing_charge_quote: CHECK (((quoted_monthly_price > (0)::numeric) AND (quoted_monthly_price <> 'NaN'::numeric) AND (quoted_volume_limit_liters > (0)::numeric) AND (quoted_volume_limit_liters <> 'NaN'::numeric) AND (quoted_collection_limit > 0) AND (amount > (0)::numeric) AND (amount <> 'NaN'::numeric)))",
        "ck_billing_charge_purpose: CHECK ((((purpose = ANY (ARRAY['INITIAL'::billing_purpose_t, 'RENEWAL'::billing_purpose_t])) AND (target_cycle_id IS NULL) AND (from_plan_id IS NULL) AND (from_monthly_price IS NULL) AND (amount = quoted_monthly_price)) OR ((purpose = 'UPGRADE'::billing_purpose_t) AND (target_cycle_id IS NOT NULL) AND (from_plan_id IS NOT NULL) AND (from_monthly_price IS NOT NULL) AND (from_monthly_price > (0)::numeric) AND (from_monthly_price <> 'NaN'::numeric) AND (from_plan_id <> plan_id) AND (amount = (quoted_monthly_price - from_monthly_price)))))",
        "ck_billing_charge_dates: CHECK ((isfinite(expires_at) AND (expires_at > created_at) AND (((status = ANY (ARRAY['OPEN'::charge_status_t, 'CANCELLATION_PENDING'::charge_status_t])) AND (closed_at IS NULL)) OR ((status = ANY (ARRAY['PAID'::charge_status_t, 'CANCELLED'::charge_status_t, 'EXPIRED'::charge_status_t])) AND (closed_at IS NOT NULL) AND isfinite(closed_at) AND (closed_at >= created_at)))))",
        "ck_billing_charge_currency: CHECK ((currency = 'BRL'::bpchar))",
        "ck_billing_charge_provider: CHECK ((btrim((provider)::text) <> ''::text))",
        "ck_billing_charge_provider_charge_id_not_blank: CHECK (((provider_charge_id IS NULL) OR (btrim((provider_charge_id)::text) <> ''::text)))",
        "ck_billing_charge_plan_name: CHECK ((btrim((plan_name)::text) <> ''::text))",
        "ck_billing_charge_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))",
        "CREATE UNIQUE INDEX uq_charge_open_period ON public.billing_charge USING btree (establishment_id) WHERE ((purpose = ANY (ARRAY['INITIAL'::billing_purpose_t, 'RENEWAL'::billing_purpose_t])) AND (status = ANY (ARRAY['OPEN'::charge_status_t, 'CANCELLATION_PENDING'::charge_status_t])))",
        "CREATE UNIQUE INDEX uq_charge_open_upgrade ON public.billing_charge USING btree (target_cycle_id) WHERE ((purpose = 'UPGRADE'::billing_purpose_t) AND (status = ANY (ARRAY['OPEN'::charge_status_t, 'CANCELLATION_PENDING'::charge_status_t])))"
      ],
      "main": [
        "id",
        "billing_order_id",
        "plan_id",
        "target_cycle_id",
        "amount",
        "status",
        "idempotency_key"
      ]
    },
    "payment": {
      "name": "payment",
      "domain": "financeiro",
      "description": "Pagamento real confirmado pelo backend. Mensagens repetidas não criam outro pagamento; valor recebido é fato.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "billing_charge_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "billing_charge_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_order",
            "fk_payment_charge_provider"
          ]
        },
        {
          "name": "billing_order_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "billing_order_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_order"
          ]
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_order"
          ]
        },
        {
          "name": "provider",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "provider character varying(100) NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_provider"
          ]
        },
        {
          "name": "provider_payment_id",
          "type": "character varying(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "provider_payment_id character varying(255) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "amount",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "amount numeric(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "currency",
          "type": "character(3)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "currency character(3) NOT NULL DEFAULT 'BRL'::bpchar",
          "description": "",
          "fk": []
        },
        {
          "name": "paid_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "paid_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "verified_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "verified_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_payment_provider",
          "columns": [
            "provider",
            "provider_payment_id"
          ]
        },
        {
          "name": "uq_payment_order",
          "columns": [
            "id",
            "billing_order_id",
            "establishment_id"
          ]
        },
        {
          "name": "uq_payment_refund_reference",
          "columns": [
            "id",
            "amount",
            "provider"
          ]
        },
        {
          "name": "uq_payment_event_reference",
          "columns": [
            "id",
            "provider",
            "provider_payment_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_payment_charge_order",
          "child": "payment",
          "parent": "billing_charge",
          "columns": [
            "billing_charge_id",
            "billing_order_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "billing_order_id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_payment_charge_provider",
          "child": "payment",
          "parent": "billing_charge",
          "columns": [
            "billing_charge_id",
            "provider"
          ],
          "references": [
            "id",
            "provider"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_payment_currency: CHECK ((currency = 'BRL'::bpchar))",
        "ck_payment_provider: CHECK ((btrim((provider)::text) <> ''::text))",
        "ck_payment_identity: CHECK ((btrim((provider_payment_id)::text) <> ''::text))",
        "ck_payment_amount: CHECK (((amount > (0)::numeric) AND (amount <> 'NaN'::numeric)))",
        "ck_payment_dates: CHECK ((isfinite(paid_at) AND isfinite(verified_at) AND isfinite(created_at) AND (paid_at <= verified_at) AND (verified_at <= created_at)))"
      ],
      "main": [
        "id",
        "billing_charge_id",
        "billing_order_id",
        "provider_payment_id",
        "amount",
        "paid_at"
      ]
    },
    "payment_application": {
      "name": "payment_application",
      "domain": "financeiro",
      "description": "Um benefício recebe no máximo um pagamento. Criar/aplicar ciclo ou upgrade na mesma transação.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "payment_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "payment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_application_payment_order"
          ]
        },
        {
          "name": "billing_order_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "billing_order_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_application_payment_order",
            "fk_application_order"
          ]
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_application_payment_order",
            "fk_application_order",
            "fk_application_cycle_owner"
          ]
        },
        {
          "name": "purpose",
          "type": "billing_purpose_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "purpose billing_purpose_t NOT NULL",
          "description": "",
          "fk": [
            "fk_application_order"
          ]
        },
        {
          "name": "cycle_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cycle_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_application_cycle_owner"
          ]
        },
        {
          "name": "applied_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "applied_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "payment_application_payment_id_key",
          "columns": [
            "payment_id"
          ]
        },
        {
          "name": "payment_application_billing_order_id_key",
          "columns": [
            "billing_order_id"
          ]
        },
        {
          "name": "uq_application_cycle",
          "columns": [
            "id",
            "cycle_id",
            "purpose"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_application_payment_order",
          "child": "payment_application",
          "parent": "payment",
          "columns": [
            "payment_id",
            "billing_order_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "billing_order_id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_application_order",
          "child": "payment_application",
          "parent": "billing_order",
          "columns": [
            "billing_order_id",
            "establishment_id",
            "purpose"
          ],
          "references": [
            "id",
            "establishment_id",
            "purpose"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_application_cycle_owner",
          "child": "payment_application",
          "parent": "subscription_cycle",
          "columns": [
            "cycle_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_payment_application_dates: CHECK ((isfinite(applied_at) AND isfinite(created_at) AND (applied_at <= created_at)))",
        "CREATE UNIQUE INDEX uq_application_initial_cycle ON public.payment_application USING btree (cycle_id) WHERE (purpose = ANY (ARRAY['INITIAL'::billing_purpose_t, 'RENEWAL'::billing_purpose_t]))"
      ],
      "main": [
        "id",
        "payment_id",
        "billing_order_id",
        "cycle_id",
        "purpose",
        "applied_at"
      ]
    },
    "subscription_cycle_change": {
      "name": "subscription_cycle_change",
      "domain": "planos",
      "description": "Histórico de upgrade pago: antes/depois dos limites. Não muda datas nem soma franquias.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "cycle_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "cycle_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_change_application"
          ]
        },
        {
          "name": "payment_application_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "payment_application_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_change_application"
          ]
        },
        {
          "name": "purpose",
          "type": "billing_purpose_t",
          "pk": false,
          "unique": false,
          "generated": "'UPGRADE'::billing_purpose_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "purpose billing_purpose_t GENERATED ALWAYS AS ('UPGRADE'::billing_purpose_t) STORED",
          "description": "",
          "fk": [
            "fk_cycle_change_application"
          ]
        },
        {
          "name": "from_plan_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "from_plan_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_change_from_plan"
          ]
        },
        {
          "name": "to_plan_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "to_plan_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_change_to_plan"
          ]
        },
        {
          "name": "from_monthly_price",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "from_monthly_price numeric(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "to_monthly_price",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "to_monthly_price numeric(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "from_volume_limit_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "from_volume_limit_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "to_volume_limit_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "to_volume_limit_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "from_collection_limit",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "from_collection_limit integer NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "to_collection_limit",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "to_collection_limit integer NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "applied_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "applied_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "subscription_cycle_change_payment_application_id_key",
          "columns": [
            "payment_application_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_cycle_change_application",
          "child": "subscription_cycle_change",
          "parent": "payment_application",
          "columns": [
            "payment_application_id",
            "cycle_id",
            "purpose"
          ],
          "references": [
            "id",
            "cycle_id",
            "purpose"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_cycle_change_from_plan",
          "child": "subscription_cycle_change",
          "parent": "subscription_plan",
          "columns": [
            "from_plan_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_cycle_change_to_plan",
          "child": "subscription_cycle_change",
          "parent": "subscription_plan",
          "columns": [
            "to_plan_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_subscription_cycle_change_dates: CHECK ((isfinite(applied_at) AND isfinite(created_at) AND (applied_at <= created_at)))",
        "ck_subscription_cycle_change_plans: CHECK ((from_plan_id <> to_plan_id))",
        "ck_subscription_cycle_change_limits: CHECK (((from_monthly_price > (0)::numeric) AND (to_monthly_price > from_monthly_price) AND (to_monthly_price <> 'NaN'::numeric) AND (from_volume_limit_liters > (0)::numeric) AND (to_volume_limit_liters > from_volume_limit_liters) AND (to_volume_limit_liters <> 'NaN'::numeric) AND (from_collection_limit > 0) AND (to_collection_limit > from_collection_limit)))"
      ],
      "main": [
        "id",
        "cycle_id",
        "payment_application_id",
        "from_plan_id",
        "to_plan_id",
        "applied_at"
      ]
    },
    "payment_refund": {
      "name": "payment_refund",
      "domain": "financeiro",
      "description": "Reembolso integral único por pagamento nos dois casos aprovados. Solicitação não significa conclusão.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "payment_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "payment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_refund_payment"
          ]
        },
        {
          "name": "reason",
          "type": "refund_reason_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "reason refund_reason_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "amount",
          "type": "numeric(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "amount numeric(10,2) NOT NULL",
          "description": "",
          "fk": [
            "fk_refund_payment"
          ]
        },
        {
          "name": "provider",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "provider character varying(100) NOT NULL",
          "description": "",
          "fk": [
            "fk_refund_payment"
          ]
        },
        {
          "name": "status",
          "type": "refund_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status refund_status_t NOT NULL DEFAULT 'REQUESTED'::refund_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "idempotency_key",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "idempotency_key uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "provider_refund_id",
          "type": "character varying(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "provider_refund_id character varying(255)",
          "description": "",
          "fk": []
        },
        {
          "name": "requested_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "requested_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "completed_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "completed_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "next_attempt_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "next_attempt_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "last_error",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "last_error text",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "payment_refund_payment_id_key",
          "columns": [
            "payment_id"
          ]
        },
        {
          "name": "payment_refund_idempotency_key_key",
          "columns": [
            "idempotency_key"
          ]
        },
        {
          "name": "uq_refund_provider",
          "columns": [
            "provider",
            "provider_refund_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_refund_payment",
          "child": "payment_refund",
          "parent": "payment",
          "columns": [
            "payment_id",
            "amount",
            "provider"
          ],
          "references": [
            "id",
            "amount",
            "provider"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        }
      ],
      "special": [
        "ck_payment_refund_amount: CHECK (((amount > (0)::numeric) AND (amount <> 'NaN'::numeric)))",
        "ck_payment_refund_completion: CHECK ((((status = 'COMPLETED'::refund_status_t) AND (completed_at IS NOT NULL) AND isfinite(completed_at) AND (completed_at >= requested_at)) OR ((status <> 'COMPLETED'::refund_status_t) AND (completed_at IS NULL))))",
        "ck_payment_refund_requested_at: CHECK (isfinite(requested_at))",
        "ck_payment_refund_provider_refund_id_not_blank: CHECK (((provider_refund_id IS NULL) OR (btrim((provider_refund_id)::text) <> ''::text)))",
        "ck_payment_refund_next_attempt: CHECK (((next_attempt_at IS NULL) OR isfinite(next_attempt_at)))"
      ],
      "main": [
        "id",
        "payment_id",
        "amount",
        "reason",
        "status",
        "idempotency_key"
      ]
    },
    "collection_request": {
      "name": "collection_request",
      "domain": "b2b",
      "description": "Reserva estimativa + uma vaga desde PENDING no ciclo de origem. Após coleta, não permitir cancelamento.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "estimated_volume_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "estimated_volume_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "status",
          "type": "request_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status request_status_t NOT NULL DEFAULT 'PENDING'::request_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "observation",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "observation text",
          "description": "",
          "fk": []
        },
        {
          "name": "request_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "request_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_request_cycle_owner"
          ]
        },
        {
          "name": "subscription_cycle_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "subscription_cycle_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_request_cycle_owner"
          ]
        },
        {
          "name": "idempotency_key",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "idempotency_key uuid NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "approved_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "approved_by uuid",
          "description": "",
          "fk": [
            "fk_request_admin"
          ]
        },
        {
          "name": "approved_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "approved_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'ADMIN'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_request_admin"
          ]
        },
        {
          "name": "scheduled_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "scheduled_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "arrived_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "arrived_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "arrival_recorded_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "arrival_recorded_at timestamp with time zone",
          "description": "Momento registrado pelo backend; informar depois não penaliza retroativamente um cancelamento gratuito.",
          "fk": []
        },
        {
          "name": "arrival_driver_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "arrival_driver_id uuid",
          "description": "",
          "fk": [
            "fk_request_arrival_driver"
          ]
        },
        {
          "name": "service_accepted_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "service_accepted_at timestamp with time zone",
          "description": "Aceite do estabelecimento para início do atendimento; após chegada atrasada, encerra a opção de cancelar gratuitamente.",
          "fk": []
        },
        {
          "name": "service_acceptance_recorded_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "service_acceptance_recorded_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "service_accepted_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "service_accepted_by uuid",
          "description": "",
          "fk": [
            "fk_request_service_accepted_by"
          ]
        },
        {
          "name": "cancelled_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "cancelled_at timestamp with time zone",
          "description": "Instante efetivo da decisão de cancelamento, validado pelo backend; não é horário livre informado pelo cliente.",
          "fk": []
        },
        {
          "name": "cancellation_recorded_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "cancellation_recorded_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "cancelled_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "cancelled_by uuid",
          "description": "",
          "fk": [
            "fk_request_cancelled_by"
          ]
        },
        {
          "name": "cancellation_initiative",
          "type": "cancellation_initiative_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "cancellation_initiative cancellation_initiative_t",
          "description": "",
          "fk": []
        },
        {
          "name": "cancellation_policy",
          "type": "cancellation_policy_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "cancellation_policy cancellation_policy_t",
          "description": "",
          "fk": []
        },
        {
          "name": "cancellation_reason",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "cancellation_reason text",
          "description": "",
          "fk": []
        },
        {
          "name": "forfeited_volume_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "forfeited_volume_liters numeric(8,2) NOT NULL DEFAULT 0",
          "description": "Franquia perdida por cancelamento tardio; não representa óleo recolhido, pontos ou volume ambiental.",
          "fk": []
        },
        {
          "name": "forfeited_collection_slots",
          "type": "smallint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "forfeited_collection_slots smallint NOT NULL DEFAULT 0",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_request_owner_status",
          "columns": [
            "id",
            "establishment_id",
            "status"
          ]
        },
        {
          "name": "uq_request_idempotency",
          "columns": [
            "establishment_id",
            "idempotency_key"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_request_cycle_owner",
          "child": "collection_request",
          "parent": "subscription_cycle",
          "columns": [
            "subscription_cycle_id",
            "establishment_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_request_admin",
          "child": "collection_request",
          "parent": "users",
          "columns": [
            "approved_by",
            "admin_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_request_cancelled_by",
          "child": "collection_request",
          "parent": "users",
          "columns": [
            "cancelled_by"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_request_arrival_driver",
          "child": "collection_request",
          "parent": "driver",
          "columns": [
            "arrival_driver_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_request_service_accepted_by",
          "child": "collection_request",
          "parent": "establishment",
          "columns": [
            "service_accepted_by"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_collection_request_volume: CHECK (((estimated_volume_liters > (0)::numeric) AND (estimated_volume_liters <> 'NaN'::numeric)))",
        "ck_collection_request_updated_at: CHECK ((isfinite(request_at) AND isfinite(updated_at) AND (updated_at >= request_at)))",
        "ck_collection_request_approval: CHECK ((((approved_at IS NULL) = (approved_by IS NULL)) AND ((status <> 'APPROVED'::request_status_t) OR ((approved_at IS NOT NULL) AND (scheduled_at IS NOT NULL))) AND ((approved_at IS NULL) OR (isfinite(approved_at) AND (approved_at >= request_at))) AND ((scheduled_at IS NULL) OR (isfinite(scheduled_at) AND (scheduled_at >= request_at)))))",
        "ck_collection_request_arrival: CHECK ((((arrived_at IS NULL) AND (arrival_recorded_at IS NULL) AND (arrival_driver_id IS NULL)) OR ((arrived_at IS NOT NULL) AND (arrival_recorded_at IS NOT NULL) AND (arrival_driver_id IS NOT NULL) AND isfinite(arrived_at) AND isfinite(arrival_recorded_at) AND (arrived_at >= request_at) AND (arrival_recorded_at >= arrived_at))))",
        "ck_collection_request_arrival_approval: CHECK (((arrived_at IS NULL) OR ((approved_at IS NOT NULL) AND (scheduled_at IS NOT NULL))))",
        "ck_collection_request_service_acceptance: CHECK ((((service_accepted_at IS NULL) AND (service_acceptance_recorded_at IS NULL) AND (service_accepted_by IS NULL)) OR ((service_accepted_at IS NOT NULL) AND (service_acceptance_recorded_at IS NOT NULL) AND (service_accepted_by IS NOT NULL) AND (service_accepted_by = establishment_id) AND isfinite(service_accepted_at) AND isfinite(service_acceptance_recorded_at) AND (arrived_at IS NOT NULL) AND (arrival_recorded_at IS NOT NULL) AND (service_accepted_at >= arrived_at) AND (service_acceptance_recorded_at >= service_accepted_at) AND (service_acceptance_recorded_at >= arrival_recorded_at) AND (status = 'APPROVED'::request_status_t))))",
        "ck_collection_request_cancellation: CHECK ((((status <> 'CANCELLED'::request_status_t) AND (cancelled_at IS NULL) AND (cancellation_recorded_at IS NULL) AND (cancelled_by IS NULL) AND (cancellation_initiative IS NULL) AND (cancellation_policy IS NULL) AND (cancellation_reason IS NULL) AND (forfeited_volume_liters = (0)::numeric) AND (forfeited_collection_slots = 0)) OR ((status = 'CANCELLED'::request_status_t) AND (cancelled_at IS NOT NULL) AND (cancellation_recorded_at IS NOT NULL) AND (cancelled_by IS NOT NULL) AND (cancellation_initiative IS NOT NULL) AND (cancellation_policy IS NOT NULL) AND (cancellation_reason IS NOT NULL) AND (btrim(cancellation_reason) <> ''::text) AND isfinite(cancelled_at) AND isfinite(cancellation_recorded_at) AND (cancelled_at >= request_at) AND (cancellation_recorded_at >= cancelled_at) AND (((cancellation_policy = 'FREE'::cancellation_policy_t) AND (forfeited_volume_liters = (0)::numeric) AND (forfeited_collection_slots = 0)) OR ((cancellation_policy = 'LATE_FORFEITURE'::cancellation_policy_t) AND (cancellation_initiative = 'ESTABLISHMENT'::cancellation_initiative_t) AND (approved_at IS NOT NULL) AND (scheduled_at IS NOT NULL) AND (cancelled_at > (scheduled_at - '04:00:00'::interval)) AND (forfeited_volume_liters = estimated_volume_liters) AND (forfeited_collection_slots = 1))))))",
        "ck_collection_request_cancellation_timing: CHECK (((status <> 'CANCELLED'::request_status_t) OR (((cancellation_policy = 'FREE'::cancellation_policy_t) AND ((cancellation_initiative = 'OPERATION'::cancellation_initiative_t) OR (approved_at IS NULL) OR (scheduled_at IS NULL) OR (cancelled_at <= (scheduled_at - '04:00:00'::interval)) OR ((cancelled_at >= (scheduled_at + '01:00:00'::interval)) AND ((arrived_at IS NULL) OR (arrival_recorded_at > cancellation_recorded_at) OR (arrived_at >= (scheduled_at + '01:00:00'::interval)))))) OR ((cancellation_policy = 'LATE_FORFEITURE'::cancellation_policy_t) AND ((cancelled_at < (scheduled_at + '01:00:00'::interval)) OR ((arrived_at IS NOT NULL) AND (arrival_recorded_at IS NOT NULL) AND (arrival_recorded_at <= cancellation_recorded_at) AND (arrived_at < (scheduled_at + '01:00:00'::interval))))))))"
      ],
      "main": [
        "id",
        "subscription_cycle_id",
        "establishment_id",
        "estimated_volume_liters",
        "scheduled_at",
        "status"
      ]
    },
    "collection_schedule_history": {
      "name": "collection_schedule_history",
      "domain": "b2b",
      "description": "Agendamento inicial e reagendamentos acordados, com horários anterior/novo e autoria administrativa.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_request_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "collection_request_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_schedule_request"
          ]
        },
        {
          "name": "previous_scheduled_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "previous_scheduled_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "new_scheduled_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "new_scheduled_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "agreed_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "agreed_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "changed_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "changed_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "changed_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "changed_by uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_schedule_admin"
          ]
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'ADMIN'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_schedule_admin"
          ]
        },
        {
          "name": "reason",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "reason text NOT NULL",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "fk_schedule_request",
          "child": "collection_schedule_history",
          "parent": "collection_request",
          "columns": [
            "collection_request_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_schedule_admin",
          "child": "collection_schedule_history",
          "parent": "users",
          "columns": [
            "changed_by",
            "admin_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_collection_schedule_history_dates: CHECK ((isfinite(new_scheduled_at) AND isfinite(agreed_at) AND isfinite(changed_at) AND (agreed_at <= changed_at) AND ((previous_scheduled_at IS NULL) OR (isfinite(previous_scheduled_at) AND (previous_scheduled_at <> new_scheduled_at)))))",
        "ck_collection_schedule_history_reason: CHECK ((btrim(reason) <> ''::text))"
      ],
      "main": [
        "id",
        "collection_request_id",
        "previous_scheduled_at",
        "new_scheduled_at",
        "changed_by",
        "reason"
      ]
    },
    "collection": {
      "name": "collection",
      "domain": "b2b",
      "description": "Visita B2B realizada, inclusive zero recolhido. A FK exige pedido aprovado e bloqueia seu cancelamento após a coleta. Resultado e pontos são derivados pelas rotinas.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "collected_volume_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "collected_volume_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "presented_volume_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "presented_volume_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "oil_condition",
          "type": "oil_condition_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "oil_condition oil_condition_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "has_compromising_occurrence",
          "type": "boolean",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "has_compromising_occurrence boolean NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "result",
          "type": "collection_result_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "result collection_result_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "points_earned",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "points_earned bigint NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "observation",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "observation text",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_date",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "collection_date timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_request_id",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "collection_request_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_collection_request_owner"
          ]
        },
        {
          "name": "request_status",
          "type": "request_status_t",
          "pk": false,
          "unique": false,
          "generated": "'APPROVED'::request_status_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "request_status request_status_t GENERATED ALWAYS AS ('APPROVED'::request_status_t) STORED",
          "description": "",
          "fk": [
            "fk_collection_request_owner"
          ]
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_collection_request_owner"
          ]
        },
        {
          "name": "processing_order",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "processing_order bigint NOT NULL",
          "description": "Ordem fixa por estabelecimento para reconstruir pontos e piso zero, independente da data física da visita.",
          "fk": []
        },
        {
          "name": "driver_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "driver_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_collection_driver"
          ]
        },
        {
          "name": "record_status",
          "type": "record_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "record_status record_status_t NOT NULL DEFAULT 'RECORDED'::record_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "revision",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "revision integer NOT NULL DEFAULT 1",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "corrected_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "corrected_by uuid",
          "description": "",
          "fk": [
            "fk_collection_correction_admin"
          ]
        },
        {
          "name": "correction_reason",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "correction_reason text",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'ADMIN'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_collection_correction_admin"
          ]
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "collection_collection_request_id_key",
          "columns": [
            "collection_request_id"
          ]
        },
        {
          "name": "uq_collection_order",
          "columns": [
            "establishment_id",
            "processing_order"
          ]
        },
        {
          "name": "uq_collection_owner",
          "columns": [
            "id",
            "establishment_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_collection_request_owner",
          "child": "collection",
          "parent": "collection_request",
          "columns": [
            "collection_request_id",
            "establishment_id",
            "request_status"
          ],
          "references": [
            "id",
            "establishment_id",
            "status"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..1"
        },
        {
          "name": "fk_collection_driver",
          "child": "collection",
          "parent": "driver",
          "columns": [
            "driver_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_collection_correction_admin",
          "child": "collection",
          "parent": "users",
          "columns": [
            "corrected_by",
            "admin_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_collection_volumes: CHECK (((presented_volume_liters >= (0)::numeric) AND (presented_volume_liters <> 'NaN'::numeric) AND (collected_volume_liters >= (0)::numeric) AND (collected_volume_liters <= presented_volume_liters)))",
        "ck_collection_condition_presented: CHECK ((((presented_volume_liters = (0)::numeric) AND (oil_condition = 'NOT_ASSESSED'::oil_condition_t)) OR ((presented_volume_liters > (0)::numeric) AND (oil_condition = ANY (ARRAY['ACCEPTABLE'::oil_condition_t, 'UNACCEPTABLE'::oil_condition_t])))))",
        "ck_collection_success_conditions: CHECK (((result <> 'SUCCESSFUL'::collection_result_t) OR ((collected_volume_liters > (0)::numeric) AND (oil_condition IS NOT NULL) AND (oil_condition = 'ACCEPTABLE'::oil_condition_t) AND (NOT has_compromising_occurrence))))",
        "ck_collection_explanation: CHECK (((NOT ((presented_volume_liters = (0)::numeric) OR (oil_condition = 'UNACCEPTABLE'::oil_condition_t) OR has_compromising_occurrence)) OR ((observation IS NOT NULL) AND (btrim(observation) <> ''::text))))",
        "ck_collection_points: CHECK ((((record_status = 'ANNULLED'::record_status_t) AND (points_earned = 0)) OR ((record_status = 'RECORDED'::record_status_t) AND (((result = 'UNSUCCESSFUL'::collection_result_t) AND (points_earned = '-50'::integer)) OR ((result = 'SUCCESSFUL'::collection_result_t) AND (points_earned >= ((floor(collected_volume_liters))::bigint + 50)) AND (points_earned <= ((floor(collected_volume_liters))::bigint + 150)) AND ((((points_earned - (floor(collected_volume_liters))::bigint) - 50) % (10)::bigint) = 0))))))",
        "ck_collection_order: CHECK ((processing_order > 0))",
        "ck_collection_dates: CHECK ((isfinite(collection_date) AND isfinite(created_at) AND (collection_date <= created_at)))",
        "ck_collection_correction: CHECK ((((revision = 1) AND (record_status = 'RECORDED'::record_status_t) AND (corrected_at IS NULL) AND (corrected_by IS NULL) AND (correction_reason IS NULL)) OR ((revision > 1) AND (corrected_at IS NOT NULL) AND (corrected_by IS NOT NULL) AND (correction_reason IS NOT NULL) AND (btrim(correction_reason) <> ''::text) AND isfinite(corrected_at) AND (corrected_at >= created_at))))"
      ],
      "main": [
        "id",
        "collection_request_id",
        "establishment_id",
        "driver_id",
        "presented_volume_liters",
        "collected_volume_liters",
        "result",
        "points_earned"
      ]
    },
    "collection_failure_reason": {
      "name": "collection_failure_reason",
      "domain": "b2b",
      "description": "Catálogo dos motivos de malsucesso, sem criar penalidades adicionais por motivo.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "code",
          "type": "character varying(50)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "code character varying(50) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "character varying(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "name character varying(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "description text",
          "description": "",
          "fk": []
        },
        {
          "name": "status",
          "type": "active_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'::active_status_t",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "collection_failure_reason_code_key",
          "columns": [
            "code"
          ]
        }
      ],
      "fks": [],
      "special": [
        "ck_collection_failure_reason_name_not_blank: CHECK ((btrim((name)::text) <> ''::text))",
        "ck_collection_failure_reason_code: CHECK ((btrim((code)::text) <> ''::text))"
      ],
      "main": [
        "id",
        "code",
        "name",
        "status"
      ]
    },
    "collection_failure": {
      "name": "collection_failure",
      "domain": "b2b",
      "description": "Associação N:N sem repetição. Rotina mantém motivos coerentes com resultado e corrige com auditoria.",
      "columns": [
        {
          "name": "collection_id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "collection_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_failure_collection"
          ]
        },
        {
          "name": "failure_reason_id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "failure_reason_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_failure_reason"
          ]
        }
      ],
      "pk": [
        "collection_id",
        "failure_reason_id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "fk_failure_collection",
          "child": "collection_failure",
          "parent": "collection",
          "columns": [
            "collection_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_failure_reason",
          "child": "collection_failure",
          "parent": "collection_failure_reason",
          "columns": [
            "failure_reason_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [],
      "main": [
        "collection_id",
        "failure_reason_id"
      ]
    },
    "delivery_pev": {
      "name": "delivery_pev",
      "domain": "b2c",
      "description": "Somente volume B2C aceito positivo. Validador é o responsável do PEV aprovado; anulação é correção administrativa.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "oil_volume_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "oil_volume_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "points_earned",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "points_earned bigint NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "delivery_date",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "delivery_date timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "citizen_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "citizen_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_delivery_citizen"
          ]
        },
        {
          "name": "processing_order",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "processing_order bigint NOT NULL",
          "description": "Ordem fixa por cidadão para reconstruir pontos e saldos, independente da data física da entrega. Atribuída sob bloqueio do cidadão e preservada nas correções.",
          "fk": []
        },
        {
          "name": "pev_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "pev_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_delivery_pev"
          ]
        },
        {
          "name": "validated_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "validated_by uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_delivery_validator"
          ]
        },
        {
          "name": "idempotency_key",
          "type": "uuid",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "idempotency_key uuid NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "record_status",
          "type": "record_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "record_status record_status_t NOT NULL DEFAULT 'RECORDED'::record_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "revision",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "revision integer NOT NULL DEFAULT 1",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "corrected_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "corrected_by uuid",
          "description": "",
          "fk": [
            "fk_delivery_correction_admin"
          ]
        },
        {
          "name": "correction_reason",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "correction_reason text",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'ADMIN'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_delivery_correction_admin"
          ]
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_delivery_owner",
          "columns": [
            "id",
            "citizen_id"
          ]
        },
        {
          "name": "uq_delivery_order",
          "columns": [
            "citizen_id",
            "processing_order"
          ]
        },
        {
          "name": "uq_delivery_idempotency",
          "columns": [
            "idempotency_key"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_delivery_citizen",
          "child": "delivery_pev",
          "parent": "citizens",
          "columns": [
            "citizen_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_delivery_pev",
          "child": "delivery_pev",
          "parent": "pev",
          "columns": [
            "pev_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_delivery_validator",
          "child": "delivery_pev",
          "parent": "users",
          "columns": [
            "validated_by"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_delivery_correction_admin",
          "child": "delivery_pev",
          "parent": "users",
          "columns": [
            "corrected_by",
            "admin_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_delivery_pev_volume: CHECK (((oil_volume_liters > (0)::numeric) AND (oil_volume_liters <> 'NaN'::numeric)))",
        "ck_delivery_pev_points: CHECK ((points_earned =\\nCASE\\n    WHEN (record_status = 'ANNULLED'::record_status_t) THEN (0)::bigint\\n    ELSE (floor(oil_volume_liters))::bigint\\nEND))",
        "ck_delivery_pev_dates: CHECK ((isfinite(delivery_date) AND isfinite(created_at) AND (delivery_date <= created_at)))",
        "ck_delivery_pev_order: CHECK ((processing_order > 0))",
        "ck_delivery_pev_correction: CHECK ((((revision = 1) AND (record_status = 'RECORDED'::record_status_t) AND (corrected_at IS NULL) AND (corrected_by IS NULL) AND (correction_reason IS NULL)) OR ((revision > 1) AND (corrected_at IS NOT NULL) AND (corrected_by IS NOT NULL) AND (correction_reason IS NOT NULL) AND (btrim(correction_reason) <> ''::text) AND isfinite(corrected_at) AND (corrected_at >= created_at))))"
      ],
      "main": [
        "id",
        "citizen_id",
        "pev_id",
        "validated_by",
        "oil_volume_liters",
        "points_earned",
        "record_status"
      ]
    },
    "point_calculation": {
      "name": "point_calculation",
      "domain": "pontos",
      "description": "Revisão de cálculo por evento. Piso zero aplicado em sequência, não ao somatório final; preservar revisões anteriores.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "user_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "user_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_point_calculation_user",
            "fk_point_calculation_collection",
            "fk_point_calculation_delivery"
          ]
        },
        {
          "name": "collection_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "collection_id uuid",
          "description": "",
          "fk": [
            "fk_point_calculation_collection"
          ]
        },
        {
          "name": "delivery_pev_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "delivery_pev_id uuid",
          "description": "",
          "fk": [
            "fk_point_calculation_delivery"
          ]
        },
        {
          "name": "revision",
          "type": "integer",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "revision integer NOT NULL",
          "description": "Revisão do cálculo, inclusive por correção de evento anterior; não precisa coincidir com a revisão da coleta.",
          "fk": []
        },
        {
          "name": "is_current",
          "type": "boolean",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "is_current boolean NOT NULL DEFAULT true",
          "description": "",
          "fk": []
        },
        {
          "name": "points_total",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "points_total bigint NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "balance_before",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "balance_before bigint NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "balance_after",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "balance_after bigint NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "successful_collections_count",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "successful_collections_count bigint",
          "description": "",
          "fk": []
        },
        {
          "name": "calculated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "calculated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "recalculated_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "recalculated_by uuid",
          "description": "",
          "fk": [
            "fk_point_calculation_admin"
          ]
        },
        {
          "name": "recalculation_reason",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "recalculation_reason text",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "'ADMIN'::user_type_t",
          "nullable": true,
          "constantNonNull": true,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_point_calculation_admin"
          ]
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_point_collection_revision",
          "columns": [
            "collection_id",
            "revision"
          ]
        },
        {
          "name": "uq_point_delivery_revision",
          "columns": [
            "delivery_pev_id",
            "revision"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_point_calculation_user",
          "child": "point_calculation",
          "parent": "users",
          "columns": [
            "user_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_point_calculation_collection",
          "child": "point_calculation",
          "parent": "collection",
          "columns": [
            "collection_id",
            "user_id"
          ],
          "references": [
            "id",
            "establishment_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_point_calculation_delivery",
          "child": "point_calculation",
          "parent": "delivery_pev",
          "columns": [
            "delivery_pev_id",
            "user_id"
          ],
          "references": [
            "id",
            "citizen_id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "fk_point_calculation_admin",
          "child": "point_calculation",
          "parent": "users",
          "columns": [
            "recalculated_by",
            "admin_type"
          ],
          "references": [
            "id",
            "user_type"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_point_calculation_source: CHECK (((collection_id IS NOT NULL) <> (delivery_pev_id IS NOT NULL)))",
        "ck_point_calculation_balance: CHECK (((balance_before >= 0) AND (balance_after >= 0) AND ((balance_after)::numeric = GREATEST((0)::numeric, ((balance_before)::numeric + (points_total)::numeric)))))",
        "ck_point_calculation_success_count: CHECK ((((collection_id IS NOT NULL) AND (successful_collections_count IS NOT NULL) AND (successful_collections_count >= 0)) OR ((delivery_pev_id IS NOT NULL) AND (successful_collections_count IS NULL) AND (points_total >= 0))))",
        "ck_point_calculation_revision: CHECK ((isfinite(calculated_at) AND (((revision = 1) AND (recalculated_by IS NULL) AND (recalculation_reason IS NULL)) OR ((revision > 1) AND (recalculated_by IS NOT NULL) AND (recalculation_reason IS NOT NULL) AND (btrim(recalculation_reason) <> ''::text)))))",
        "CREATE UNIQUE INDEX uq_point_collection_current ON public.point_calculation USING btree (collection_id) WHERE (is_current AND (collection_id IS NOT NULL))",
        "CREATE UNIQUE INDEX uq_point_delivery_current ON public.point_calculation USING btree (delivery_pev_id) WHERE (is_current AND (delivery_pev_id IS NOT NULL))"
      ],
      "main": [
        "id",
        "user_id",
        "collection_id",
        "delivery_pev_id",
        "revision",
        "is_current",
        "points_total"
      ]
    },
    "point_transaction": {
      "name": "point_transaction",
      "domain": "pontos",
      "description": "Componentes nominais de uma revisão: volume, sucesso, recorrência ou penalidade única. Sem ajuste manual livre.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "point_calculation_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "point_calculation_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_point_transaction_calculation"
          ]
        },
        {
          "name": "component",
          "type": "point_component_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "component point_component_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "points",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "points bigint NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_point_component",
          "columns": [
            "point_calculation_id",
            "component"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_point_transaction_calculation",
          "child": "point_transaction",
          "parent": "point_calculation",
          "columns": [
            "point_calculation_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_point_transaction_component: CHECK ((((component = 'VOLUME'::point_component_t) AND (points >= 0)) OR ((component = 'SUCCESS_BONUS'::point_component_t) AND (points = 50)) OR ((component = 'FAILURE_PENALTY'::point_component_t) AND (points = '-50'::integer)) OR ((component = 'RECURRENCE_BONUS'::point_component_t) AND ((points >= 10) AND (points <= 100)) AND ((points % (10)::bigint) = 0))))"
      ],
      "main": [
        "id",
        "point_calculation_id",
        "component",
        "points"
      ]
    },
    "certificate_level": {
      "name": "certificate_level",
      "domain": "pontos",
      "description": "Níveis oficiais por volume acumulado efetivamente coletado: Bronze 100 L, Prata 500 L e Ouro 1.000 L; sem reinício anual.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "character varying(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "name character varying(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "description text",
          "description": "",
          "fk": []
        },
        {
          "name": "required_liters",
          "type": "numeric(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "required_liters numeric(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "badge_image_url",
          "type": "character varying(500)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "badge_image_url character varying(500)",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [],
      "special": [
        "ck_certificate_level_name_not_blank: CHECK ((btrim((name)::text) <> ''::text))",
        "ck_certificate_level_volume: CHECK (((required_liters > (0)::numeric) AND (required_liters <> 'NaN'::numeric)))",
        "ck_certificate_level_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))"
      ],
      "main": [
        "id",
        "name",
        "required_liters"
      ]
    },
    "certificate": {
      "name": "certificate",
      "domain": "pontos",
      "description": "Uma concessão por estabelecimento/nível. Revogar e reativar o mesmo registro; histórico nos logs.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "certificate_code",
          "type": "character varying(64)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "certificate_code character varying(64) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "pdf_url",
          "type": "character varying(500)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "pdf_url character varying(500)",
          "description": "",
          "fk": []
        },
        {
          "name": "issued_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "issued_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "certificate_level_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "certificate_level_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_certificate_level"
          ]
        },
        {
          "name": "establishment_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "establishment_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_certificate_establishment"
          ]
        },
        {
          "name": "status",
          "type": "certificate_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "status certificate_status_t NOT NULL DEFAULT 'ACTIVE'::certificate_status_t",
          "description": "",
          "fk": []
        },
        {
          "name": "revoked_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "revoked_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "reactivated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "reactivated_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "status_reason",
          "type": "text",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "status_reason text",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "certificate_certificate_code_key",
          "columns": [
            "certificate_code"
          ]
        },
        {
          "name": "uq_certificate_establishment_level",
          "columns": [
            "establishment_id",
            "certificate_level_id"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_certificate_level",
          "child": "certificate",
          "parent": "certificate_level",
          "columns": [
            "certificate_level_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        },
        {
          "name": "fk_certificate_establishment",
          "child": "certificate",
          "parent": "establishment",
          "columns": [
            "establishment_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_certificate_code: CHECK ((btrim((certificate_code)::text) <> ''::text))",
        "ck_certificate_dates: CHECK ((isfinite(issued_at) AND (issued_at <= created_at) AND ((revoked_at IS NULL) OR (isfinite(revoked_at) AND (revoked_at >= issued_at))) AND ((reactivated_at IS NULL) OR (isfinite(reactivated_at) AND (reactivated_at >= issued_at)))))",
        "ck_certificate_revocation: CHECK (((status <> 'REVOKED'::certificate_status_t) OR ((revoked_at IS NOT NULL) AND (status_reason IS NOT NULL) AND (btrim(status_reason) <> ''::text))))",
        "ck_certificate_timestamps: CHECK ((isfinite(created_at) AND isfinite(updated_at) AND (updated_at >= created_at)))"
      ],
      "main": [
        "id",
        "establishment_id",
        "certificate_level_id",
        "certificate_code",
        "status"
      ]
    },
    "auth_session": {
      "name": "auth_session",
      "domain": "cadastros",
      "description": "Login independente por dispositivo. Validade deriva do usuário ativo, prazo e revogação; não armazena JWT.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "user_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "user_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_auth_session_user"
          ]
        },
        {
          "name": "created_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "created_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "last_renewed_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "last_renewed_at timestamp with time zone NOT NULL",
          "description": "Login inicial ou última rotação bem-sucedida; consultas comuns não prorrogam a sessão.",
          "fk": []
        },
        {
          "name": "idle_expires_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "idle_expires_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "revoked_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "revoked_at timestamp with time zone",
          "description": "",
          "fk": []
        },
        {
          "name": "revocation_reason",
          "type": "auth_revocation_reason_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "revocation_reason auth_revocation_reason_t",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "updated_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [
        {
          "name": "fk_auth_session_user",
          "child": "auth_session",
          "parent": "users",
          "columns": [
            "user_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_auth_session_dates: CHECK ((isfinite(created_at) AND isfinite(last_renewed_at) AND isfinite(idle_expires_at) AND isfinite(updated_at) AND (last_renewed_at >= created_at) AND (idle_expires_at > last_renewed_at) AND (updated_at >= created_at) AND ((revoked_at IS NULL) OR (isfinite(revoked_at) AND (revoked_at >= created_at)))))",
        "ck_auth_session_revocation: CHECK (((revoked_at IS NULL) = (revocation_reason IS NULL)))"
      ],
      "main": [
        "id",
        "user_id",
        "idle_expires_at",
        "revoked_at"
      ]
    },
    "auth_refresh_token": {
      "name": "auth_refresh_token",
      "domain": "cadastros",
      "description": "Histórico operacional imutável de hashes SHA-256; o segredo aleatório é gerado e entregue somente pela Core.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "session_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "session_id uuid NOT NULL",
          "description": "",
          "fk": [
            "fk_auth_refresh_session"
          ]
        },
        {
          "name": "token_hash",
          "type": "bytea",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "token_hash bytea NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "generation",
          "type": "bigint",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "generation bigint NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "issued_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "issued_at timestamp with time zone NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "expires_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "expires_at timestamp with time zone NOT NULL",
          "description": "Prazo congelado na emissão. Preservar tokens consumidos para detectar reutilização.",
          "fk": []
        },
        {
          "name": "consumed_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "consumed_at timestamp with time zone",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "uq_auth_refresh_hash",
          "columns": [
            "token_hash"
          ]
        },
        {
          "name": "uq_auth_refresh_generation",
          "columns": [
            "session_id",
            "generation"
          ]
        }
      ],
      "fks": [
        {
          "name": "fk_auth_refresh_session",
          "child": "auth_refresh_token",
          "parent": "auth_session",
          "columns": [
            "session_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
          "parentCard": "1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_auth_refresh_hash: CHECK ((octet_length(token_hash) = 32))",
        "ck_auth_refresh_generation: CHECK ((generation > 0))",
        "ck_auth_refresh_dates: CHECK ((isfinite(issued_at) AND isfinite(expires_at) AND (expires_at > issued_at) AND ((consumed_at IS NULL) OR (isfinite(consumed_at) AND (consumed_at >= issued_at) AND (consumed_at < expires_at)))))",
        "CREATE UNIQUE INDEX uq_auth_refresh_unconsumed ON public.auth_refresh_token USING btree (session_id) WHERE (consumed_at IS NULL)"
      ],
      "main": [
        "id",
        "session_id",
        "generation",
        "expires_at",
        "consumed_at"
      ]
    },
    "admin_invitation": {
      "name": "admin_invitation",
      "domain": "cadastros",
      "description": "Convite de ADMIN válido por 24 horas, de uso único. users só é criado no aceite; reenvio revoga o convite anterior.",
      "columns": [
        {
          "name": "id",
          "type": "uuid",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "id uuid NOT NULL DEFAULT gen_random_uuid()",
          "description": "Identificador UUID do convite.",
          "fk": []
        },
        {
          "name": "name",
          "type": "character varying(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "name character varying(150) NOT NULL",
          "description": "Nome do futuro administrador, preservado para o aceite.",
          "fk": []
        },
        {
          "name": "email",
          "type": "character varying(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "email character varying(255) NOT NULL",
          "description": "E-mail do destinatário normalizado em minúsculas, sem espaços externos.",
          "fk": []
        },
        {
          "name": "token_hash",
          "type": "bytea",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "token_hash bytea NOT NULL",
          "description": "SHA-256 de 32 bytes do segredo aleatório; não é o token enviado por e-mail.",
          "fk": []
        },
        {
          "name": "issued_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "issued_at timestamp with time zone NOT NULL",
          "description": "Instante da emissão, definido pelo banco.",
          "fk": []
        },
        {
          "name": "expires_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "expires_at timestamp with time zone NOT NULL",
          "description": "Prazo fixo de 24 horas após a emissão.",
          "fk": []
        },
        {
          "name": "invited_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "invited_by uuid",
          "description": "ADMIN emissor; NULL somente no bootstrap restrito de implantação.",
          "fk": [
            "admin_invitation_invited_by_fkey"
          ]
        },
        {
          "name": "is_bootstrap",
          "type": "boolean",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "constantNonNull": false,
          "definition": "is_bootstrap boolean NOT NULL DEFAULT false",
          "description": "Indica emissão de implantação enquanto nenhum ADMIN está cadastrado.",
          "fk": []
        },
        {
          "name": "accepted_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "accepted_at timestamp with time zone",
          "description": "Instante de consumo único, anterior à expiração.",
          "fk": []
        },
        {
          "name": "accepted_user_id",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "accepted_user_id uuid",
          "description": "ADMIN criado atomicamente no aceite.",
          "fk": [
            "admin_invitation_accepted_user_id_fkey"
          ]
        },
        {
          "name": "revoked_at",
          "type": "timestamp with time zone",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "revoked_at timestamp with time zone",
          "description": "Instante da revogação ou substituição no reenvio.",
          "fk": []
        },
        {
          "name": "revoked_by",
          "type": "uuid",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "constantNonNull": false,
          "definition": "revoked_by uuid",
          "description": "ADMIN que revogou/substituiu; NULL no bootstrap SYSTEM.",
          "fk": [
            "admin_invitation_revoked_by_fkey"
          ]
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [
        {
          "name": "admin_invitation_token_hash_key",
          "columns": [
            "token_hash"
          ]
        }
      ],
      "fks": [
        {
          "name": "admin_invitation_invited_by_fkey",
          "child": "admin_invitation",
          "parent": "users",
          "columns": [
            "invited_by"
          ],
          "references": [
            "id"
          ],
          "actions": "ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "admin_invitation_accepted_user_id_fkey",
          "child": "admin_invitation",
          "parent": "users",
          "columns": [
            "accepted_user_id"
          ],
          "references": [
            "id"
          ],
          "actions": "ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        },
        {
          "name": "admin_invitation_revoked_by_fkey",
          "child": "admin_invitation",
          "parent": "users",
          "columns": [
            "revoked_by"
          ],
          "references": [
            "id"
          ],
          "actions": "ON DELETE RESTRICT",
          "parentCard": "0..1",
          "childCard": "0..N"
        }
      ],
      "special": [
        "ck_admin_invitation_identity: CHECK (((btrim((name)::text) <> ''::text) AND ((email)::text = lower(btrim((email)::text))) AND (POSITION(('@'::text) IN (email)) > 1)))",
        "ck_admin_invitation_hash: CHECK ((octet_length(token_hash) = 32))",
        "ck_admin_invitation_validity: CHECK ((expires_at = (issued_at + '24:00:00'::interval)))",
        "ck_admin_invitation_author: CHECK ((is_bootstrap = (invited_by IS NULL)))",
        "ck_admin_invitation_acceptance: CHECK (((accepted_at IS NULL) = (accepted_user_id IS NULL)))",
        "ck_admin_invitation_terminal: CHECK ((NOT ((accepted_at IS NOT NULL) AND (revoked_at IS NOT NULL))))",
        "ck_admin_invitation_dates: CHECK ((((accepted_at IS NULL) OR ((accepted_at >= issued_at) AND (accepted_at < expires_at))) AND ((revoked_at IS NULL) OR (revoked_at >= issued_at))))",
        "ck_admin_invitation_revoker: CHECK (((revoked_at IS NOT NULL) OR (revoked_by IS NULL)))",
        "CREATE UNIQUE INDEX uq_admin_invitation_open_email ON public.admin_invitation USING btree (email) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL))"
      ],
      "main": [
        "id",
        "email",
        "invited_by",
        "expires_at",
        "accepted_user_id",
        "revoked_at"
      ]
    }
  },
  "domains": [
    {
      "id": "cadastros",
      "title": "Cadastros e identidade",
      "subtitle": "Perfis, QR, sessões e convites ADMIN",
      "tables": [
        "users",
        "citizens",
        "establishment",
        "user_qr_code",
        "telephone",
        "addresses",
        "establishment_type",
        "auth_session",
        "auth_refresh_token",
        "admin_invitation"
      ]
    },
    {
      "id": "planos",
      "title": "Planos e ciclos",
      "subtitle": "Contrato, período pago e upgrade",
      "tables": [
        "subscription_plan",
        "establishment_subscription",
        "subscription_cycle",
        "subscription_cycle_change"
      ]
    },
    {
      "id": "financeiro",
      "title": "Cobranças e pagamentos",
      "subtitle": "Benefício, cobrança, recebimento e reembolso",
      "tables": [
        "billing_order",
        "billing_charge",
        "payment",
        "payment_application",
        "payment_refund"
      ]
    },
    {
      "id": "b2b",
      "title": "Coletas B2B",
      "subtitle": "Solicitação, agenda, visita e motivos",
      "tables": [
        "driver",
        "collection_request",
        "collection_schedule_history",
        "collection",
        "collection_failure",
        "collection_failure_reason"
      ]
    },
    {
      "id": "b2c",
      "title": "PEVs e entregas B2C",
      "subtitle": "Ponto de entrega e óleo aceito",
      "tables": [
        "pev",
        "delivery_pev"
      ]
    },
    {
      "id": "pontos",
      "title": "Pontos e certificados",
      "subtitle": "Cálculo por evento e reconhecimento",
      "tables": [
        "point_calculation",
        "point_transaction",
        "certificate_level",
        "certificate"
      ]
    }
  ],
  "scenes": [
    {
      "id": "identidade",
      "title": "01 · Identidade",
      "domain": "cadastros",
      "nodes": [
        "users",
        "telephone",
        "user_qr_code",
        "citizens",
        "establishment",
        "establishment_type",
        "addresses"
      ],
      "edges": [
        "fk_telephone_user",
        "fk_user_qr_type",
        "fk_citizens_user_type",
        "fk_citizens_qr",
        "fk_establishment_user_type",
        "fk_establishment_qr",
        "fk_establishment_type",
        "fk_establishment_address"
      ]
    },
    {
      "id": "ciclos",
      "title": "02 · Planos e ciclos",
      "domain": "planos",
      "nodes": [
        "establishment",
        "establishment_subscription",
        "subscription_plan",
        "subscription_cycle",
        "payment_application",
        "subscription_cycle_change"
      ],
      "edges": [
        "fk_subscription_establishment",
        "fk_cycle_subscription_owner",
        "fk_cycle_plan",
        "fk_application_cycle_owner",
        "fk_cycle_change_application",
        "fk_cycle_change_from_plan",
        "fk_cycle_change_to_plan"
      ]
    },
    {
      "id": "cobranca",
      "title": "03 · Cobranças",
      "domain": "financeiro",
      "nodes": [
        "establishment_subscription",
        "subscription_cycle",
        "billing_order",
        "subscription_plan",
        "billing_charge",
        "payment"
      ],
      "edges": [
        "fk_order_subscription_owner",
        "fk_order_target_cycle",
        "fk_order_previous_cycle",
        "fk_charge_order_owner",
        "fk_charge_order_target",
        "fk_charge_cycle_owner",
        "fk_charge_plan",
        "fk_charge_from_plan",
        "fk_payment_charge_order",
        "fk_payment_charge_provider"
      ]
    },
    {
      "id": "pagamento",
      "title": "04 · Aplicação e reembolso",
      "domain": "financeiro",
      "nodes": [
        "billing_order",
        "payment",
        "subscription_cycle",
        "payment_application",
        "payment_refund"
      ],
      "edges": [
        "fk_application_payment_order",
        "fk_application_order",
        "fk_application_cycle_owner",
        "fk_refund_payment"
      ]
    },
    {
      "id": "coleta",
      "title": "05 · Coletas B2B",
      "domain": "b2b",
      "nodes": [
        "subscription_cycle",
        "driver",
        "collection_request",
        "collection_schedule_history",
        "collection",
        "collection_failure_reason",
        "collection_failure"
      ],
      "edges": [
        "fk_request_cycle_owner",
        "fk_request_arrival_driver",
        "fk_schedule_request",
        "fk_collection_request_owner",
        "fk_collection_driver",
        "fk_failure_collection",
        "fk_failure_reason"
      ]
    },
    {
      "id": "entrega",
      "title": "06 · Entregas B2C",
      "domain": "b2c",
      "nodes": [
        "citizens",
        "establishment",
        "addresses",
        "pev",
        "delivery_pev"
      ],
      "edges": [
        "fk_pev_citizen",
        "fk_pev_establishment",
        "fk_pev_address",
        "fk_delivery_citizen",
        "fk_delivery_pev"
      ]
    },
    {
      "id": "pontos",
      "title": "07 · Pontuação",
      "domain": "pontos",
      "nodes": [
        "users",
        "collection",
        "delivery_pev",
        "point_calculation",
        "point_transaction"
      ],
      "edges": [
        "fk_point_calculation_user",
        "fk_point_calculation_collection",
        "fk_point_calculation_delivery",
        "fk_point_transaction_calculation"
      ]
    },
    {
      "id": "certificados",
      "title": "08 · Certificados",
      "domain": "pontos",
      "nodes": [
        "establishment",
        "certificate_level",
        "certificate"
      ],
      "edges": [
        "fk_certificate_establishment",
        "fk_certificate_level"
      ]
    },
    {
      "id": "sessoes",
      "title": "09 · Sessões e tokens",
      "domain": "cadastros",
      "nodes": [
        "users",
        "auth_session",
        "auth_refresh_token"
      ],
      "edges": [
        "fk_auth_session_user",
        "fk_auth_refresh_session"
      ]
    },
    {
      "id": "administradores",
      "title": "10 · Convites ADMIN",
      "domain": "cadastros",
      "nodes": [
        "users",
        "admin_invitation"
      ],
      "edges": [
        "admin_invitation_invited_by_fkey",
        "admin_invitation_accepted_user_id_fkey",
        "admin_invitation_revoked_by_fkey"
      ]
    }
  ],
  "fks": [
    {
      "name": "fk_telephone_user",
      "child": "telephone",
      "parent": "users",
      "columns": [
        "user_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_user_qr_type",
      "child": "user_qr_code",
      "parent": "users",
      "columns": [
        "user_id",
        "user_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_citizens_user_type",
      "child": "citizens",
      "parent": "users",
      "columns": [
        "id",
        "user_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_citizens_qr",
      "child": "citizens",
      "parent": "user_qr_code",
      "columns": [
        "id",
        "qr_token"
      ],
      "references": [
        "user_id",
        "qr_token"
      ],
      "actions": "ON UPDATE CASCADE ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_establishment_user_type",
      "child": "establishment",
      "parent": "users",
      "columns": [
        "id",
        "user_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_establishment_qr",
      "child": "establishment",
      "parent": "user_qr_code",
      "columns": [
        "id",
        "qr_token"
      ],
      "references": [
        "user_id",
        "qr_token"
      ],
      "actions": "ON UPDATE CASCADE ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_establishment_type",
      "child": "establishment",
      "parent": "establishment_type",
      "columns": [
        "type_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_establishment_address",
      "child": "establishment",
      "parent": "addresses",
      "columns": [
        "address_id",
        "address_kind"
      ],
      "references": [
        "id",
        "owner_kind"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_pev_citizen",
      "child": "pev",
      "parent": "citizens",
      "columns": [
        "citizen_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..1"
    },
    {
      "name": "fk_pev_establishment",
      "child": "pev",
      "parent": "establishment",
      "columns": [
        "establishment_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..1"
    },
    {
      "name": "fk_pev_address",
      "child": "pev",
      "parent": "addresses",
      "columns": [
        "address_id",
        "address_kind"
      ],
      "references": [
        "id",
        "owner_kind"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_pev_admin",
      "child": "pev",
      "parent": "users",
      "columns": [
        "approved_by",
        "admin_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_subscription_establishment",
      "child": "establishment_subscription",
      "parent": "establishment",
      "columns": [
        "establishment_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_cycle_subscription_owner",
      "child": "subscription_cycle",
      "parent": "establishment_subscription",
      "columns": [
        "subscription_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_cycle_plan",
      "child": "subscription_cycle",
      "parent": "subscription_plan",
      "columns": [
        "plan_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_order_subscription_owner",
      "child": "billing_order",
      "parent": "establishment_subscription",
      "columns": [
        "subscription_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_order_target_cycle",
      "child": "billing_order",
      "parent": "subscription_cycle",
      "columns": [
        "target_cycle_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_order_previous_cycle",
      "child": "billing_order",
      "parent": "subscription_cycle",
      "columns": [
        "previous_cycle_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_charge_order_owner",
      "child": "billing_charge",
      "parent": "billing_order",
      "columns": [
        "billing_order_id",
        "establishment_id",
        "purpose"
      ],
      "references": [
        "id",
        "establishment_id",
        "purpose"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_charge_order_target",
      "child": "billing_charge",
      "parent": "billing_order",
      "columns": [
        "billing_order_id",
        "target_cycle_id"
      ],
      "references": [
        "id",
        "target_cycle_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_charge_cycle_owner",
      "child": "billing_charge",
      "parent": "subscription_cycle",
      "columns": [
        "target_cycle_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_charge_plan",
      "child": "billing_charge",
      "parent": "subscription_plan",
      "columns": [
        "plan_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_charge_from_plan",
      "child": "billing_charge",
      "parent": "subscription_plan",
      "columns": [
        "from_plan_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_payment_charge_order",
      "child": "payment",
      "parent": "billing_charge",
      "columns": [
        "billing_charge_id",
        "billing_order_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "billing_order_id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_payment_charge_provider",
      "child": "payment",
      "parent": "billing_charge",
      "columns": [
        "billing_charge_id",
        "provider"
      ],
      "references": [
        "id",
        "provider"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_application_payment_order",
      "child": "payment_application",
      "parent": "payment",
      "columns": [
        "payment_id",
        "billing_order_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "billing_order_id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_application_order",
      "child": "payment_application",
      "parent": "billing_order",
      "columns": [
        "billing_order_id",
        "establishment_id",
        "purpose"
      ],
      "references": [
        "id",
        "establishment_id",
        "purpose"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_application_cycle_owner",
      "child": "payment_application",
      "parent": "subscription_cycle",
      "columns": [
        "cycle_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_cycle_change_application",
      "child": "subscription_cycle_change",
      "parent": "payment_application",
      "columns": [
        "payment_application_id",
        "cycle_id",
        "purpose"
      ],
      "references": [
        "id",
        "cycle_id",
        "purpose"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_cycle_change_from_plan",
      "child": "subscription_cycle_change",
      "parent": "subscription_plan",
      "columns": [
        "from_plan_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_cycle_change_to_plan",
      "child": "subscription_cycle_change",
      "parent": "subscription_plan",
      "columns": [
        "to_plan_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_refund_payment",
      "child": "payment_refund",
      "parent": "payment",
      "columns": [
        "payment_id",
        "amount",
        "provider"
      ],
      "references": [
        "id",
        "amount",
        "provider"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_request_cycle_owner",
      "child": "collection_request",
      "parent": "subscription_cycle",
      "columns": [
        "subscription_cycle_id",
        "establishment_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_request_admin",
      "child": "collection_request",
      "parent": "users",
      "columns": [
        "approved_by",
        "admin_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_request_cancelled_by",
      "child": "collection_request",
      "parent": "users",
      "columns": [
        "cancelled_by"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_request_arrival_driver",
      "child": "collection_request",
      "parent": "driver",
      "columns": [
        "arrival_driver_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_request_service_accepted_by",
      "child": "collection_request",
      "parent": "establishment",
      "columns": [
        "service_accepted_by"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_schedule_request",
      "child": "collection_schedule_history",
      "parent": "collection_request",
      "columns": [
        "collection_request_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_schedule_admin",
      "child": "collection_schedule_history",
      "parent": "users",
      "columns": [
        "changed_by",
        "admin_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_collection_request_owner",
      "child": "collection",
      "parent": "collection_request",
      "columns": [
        "collection_request_id",
        "establishment_id",
        "request_status"
      ],
      "references": [
        "id",
        "establishment_id",
        "status"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..1"
    },
    {
      "name": "fk_collection_driver",
      "child": "collection",
      "parent": "driver",
      "columns": [
        "driver_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_collection_correction_admin",
      "child": "collection",
      "parent": "users",
      "columns": [
        "corrected_by",
        "admin_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_failure_collection",
      "child": "collection_failure",
      "parent": "collection",
      "columns": [
        "collection_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_failure_reason",
      "child": "collection_failure",
      "parent": "collection_failure_reason",
      "columns": [
        "failure_reason_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_delivery_citizen",
      "child": "delivery_pev",
      "parent": "citizens",
      "columns": [
        "citizen_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_delivery_pev",
      "child": "delivery_pev",
      "parent": "pev",
      "columns": [
        "pev_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_delivery_validator",
      "child": "delivery_pev",
      "parent": "users",
      "columns": [
        "validated_by"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_delivery_correction_admin",
      "child": "delivery_pev",
      "parent": "users",
      "columns": [
        "corrected_by",
        "admin_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_point_calculation_user",
      "child": "point_calculation",
      "parent": "users",
      "columns": [
        "user_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_point_calculation_collection",
      "child": "point_calculation",
      "parent": "collection",
      "columns": [
        "collection_id",
        "user_id"
      ],
      "references": [
        "id",
        "establishment_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_point_calculation_delivery",
      "child": "point_calculation",
      "parent": "delivery_pev",
      "columns": [
        "delivery_pev_id",
        "user_id"
      ],
      "references": [
        "id",
        "citizen_id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_point_calculation_admin",
      "child": "point_calculation",
      "parent": "users",
      "columns": [
        "recalculated_by",
        "admin_type"
      ],
      "references": [
        "id",
        "user_type"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "fk_point_transaction_calculation",
      "child": "point_transaction",
      "parent": "point_calculation",
      "columns": [
        "point_calculation_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_certificate_level",
      "child": "certificate",
      "parent": "certificate_level",
      "columns": [
        "certificate_level_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_certificate_establishment",
      "child": "certificate",
      "parent": "establishment",
      "columns": [
        "establishment_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_auth_session_user",
      "child": "auth_session",
      "parent": "users",
      "columns": [
        "user_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "fk_auth_refresh_session",
      "child": "auth_refresh_token",
      "parent": "auth_session",
      "columns": [
        "session_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON UPDATE RESTRICT ON DELETE RESTRICT",
      "parentCard": "1",
      "childCard": "0..N"
    },
    {
      "name": "admin_invitation_invited_by_fkey",
      "child": "admin_invitation",
      "parent": "users",
      "columns": [
        "invited_by"
      ],
      "references": [
        "id"
      ],
      "actions": "ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "admin_invitation_accepted_user_id_fkey",
      "child": "admin_invitation",
      "parent": "users",
      "columns": [
        "accepted_user_id"
      ],
      "references": [
        "id"
      ],
      "actions": "ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    },
    {
      "name": "admin_invitation_revoked_by_fkey",
      "child": "admin_invitation",
      "parent": "users",
      "columns": [
        "revoked_by"
      ],
      "references": [
        "id"
      ],
      "actions": "ON DELETE RESTRICT",
      "parentCard": "0..1",
      "childCard": "0..N"
    }
  ],
  "excluded": [
    {
      "name": "addresses_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "admin_guard_state",
      "reason": "Coordenação transacional interna; não representa entidade de negócio."
    },
    {
      "name": "admin_invitation_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "auth_session_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "billing_charge_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "billing_order_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "certificate_level_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "certificate_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "citizens_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "collection_failure_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "collection_failure_reason_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "collection_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "collection_request_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "delivery_pev_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "establishment_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "establishment_subscription_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "payment_application_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "payment_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "payment_provider_event",
      "reason": "Recepção e reprocessamento técnico de eventos do provedor."
    },
    {
      "name": "payment_refund_attempt",
      "reason": "Tentativas técnicas de execução do reembolso."
    },
    {
      "name": "payment_refund_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "pev_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "point_calculation_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "subscription_cycle_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "subscription_plan_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "user_qr_code_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    },
    {
      "name": "users_log",
      "reason": "Auditoria técnica; excluída dos diagramas de negócio."
    }
  ],
  "source": {
    "file": "01_structure.sql",
    "sha256": "47bc5582b16ec87e85c2dc285aa68b063d40f581d1581de150a4b85feacf7979",
    "revision": "20/10/2026",
    "analyzed": "20/10/2026",
    "checks_sha256": "fc8d5ec45af3305c8c4e6fc585e58079d1a828a91aab1108900c0cae4379acbf",
    "indexes_sha256": "beb34aa1a7f55633b0dd75b965da39ca8df9a3cfa217d495e815d38aad467adb",
    "functions_sha256": "84b3ce08645cade18db20b0b1550da4fc371dbe6620a5bf90a89b98a4f2871d0",
    "triggers_sha256": "95dafc54bc2913f93def8bd4b66ea83e2ed7de691509c2c1dfd428486fda6275",
    "table_count": 58
  },
  "partial": [
    {
      "name": "uq_subscription_active",
      "table": "establishment_subscription",
      "columns": "establishment_id",
      "predicate": "(status = 'ACTIVE'::subscription_status_t)"
    },
    {
      "name": "uq_order_initial_subscription",
      "table": "billing_order",
      "columns": "subscription_id",
      "predicate": "(purpose = 'INITIAL'::billing_purpose_t)"
    },
    {
      "name": "uq_order_renewal_previous_cycle",
      "table": "billing_order",
      "columns": "previous_cycle_id",
      "predicate": "(purpose = 'RENEWAL'::billing_purpose_t)"
    },
    {
      "name": "uq_charge_open_period",
      "table": "billing_charge",
      "columns": "establishment_id",
      "predicate": "((purpose = ANY (ARRAY['INITIAL'::billing_purpose_t, 'RENEWAL'::billing_purpose_t])) AND (status = ANY (ARRAY['OPEN'::charge_status_t, 'CANCELLATION_PENDING'::charge_status_t])))"
    },
    {
      "name": "uq_charge_open_upgrade",
      "table": "billing_charge",
      "columns": "target_cycle_id",
      "predicate": "((purpose = 'UPGRADE'::billing_purpose_t) AND (status = ANY (ARRAY['OPEN'::charge_status_t, 'CANCELLATION_PENDING'::charge_status_t])))"
    },
    {
      "name": "uq_application_initial_cycle",
      "table": "payment_application",
      "columns": "cycle_id",
      "predicate": "(purpose = ANY (ARRAY['INITIAL'::billing_purpose_t, 'RENEWAL'::billing_purpose_t]))"
    },
    {
      "name": "uq_point_collection_current",
      "table": "point_calculation",
      "columns": "collection_id",
      "predicate": "(is_current AND (collection_id IS NOT NULL))"
    },
    {
      "name": "uq_point_delivery_current",
      "table": "point_calculation",
      "columns": "delivery_pev_id",
      "predicate": "(is_current AND (delivery_pev_id IS NOT NULL))"
    },
    {
      "name": "uq_auth_refresh_unconsumed",
      "table": "auth_refresh_token",
      "columns": "session_id",
      "predicate": "(consumed_at IS NULL)"
    },
    {
      "name": "uq_admin_invitation_open_email",
      "table": "admin_invitation",
      "columns": "email",
      "predicate": "((accepted_at IS NULL) AND (revoked_at IS NULL))"
    }
  ],
  "journeys": [
    {
      "id": "contratacao",
      "title": "Contratar o primeiro plano",
      "profile": "B2B",
      "goal": "Do plano escolhido ao primeiro período pago, com cobrança iniciada pelo estabelecimento.",
      "prerequisite": "Estabelecimento cadastrado e autenticado; catálogo de planos configurado; integração de pagamento disponível para executar o processo.",
      "outcome": "Assinatura ativa, ciclo pago e aplicação do pagamento vinculados ao mesmo estabelecimento.",
      "references": "Regras de Negócio, revisão 2: §§ 10.5, 10.8, 10.11 e 10.12; scripts 01 e 02.",
      "scope": "Contratação inicial. Renovação e upgrade possuem regras próprias e não são simulados nesta jornada.",
      "steps": [
        {
          "id": "escolher",
          "title": "Escolher as condições do plano",
          "actor": "Estabelecimento · backend",
          "domain": "planos",
          "result": "Plano e titular identificados; ainda não há um período pago liberado.",
          "operations": [
            {
              "table": "establishment",
              "action": "Consultar",
              "fields": [
                "id"
              ],
              "why": "Identificar o titular autenticado."
            },
            {
              "table": "subscription_plan",
              "action": "Consultar",
              "fields": [
                "id",
                "name",
                "status",
                "monthly_price",
                "volume_limit_liters",
                "collection_limit"
              ],
              "why": "Apresentar preço e limites do plano ativo."
            },
            {
              "table": "establishment_subscription",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "status"
              ],
              "why": "Verificar se o caso é contratação inicial e evitar criar outro vínculo ativo."
            }
          ],
          "rules": [
            "01: a assinatura referencia establishment; UNIQUE parcial limita a uma assinatura ACTIVE por estabelecimento.",
            "02: preço, litros e vagas do plano precisam ser positivos."
          ],
          "routine": "Autenticar o titular e decidir se a contratação inicial é aplicável. A existência de linhas não comprova elegibilidade.",
          "branches": [
            {
              "condition": "Já existe uma assinatura ativa",
              "outcome": "Consultar o contrato existente; esta jornada não cria uma segunda assinatura ativa.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "ordem",
          "title": "Registrar a intenção de contratar",
          "actor": "Backend",
          "domain": "financeiro",
          "result": "Uma ordem identifica o benefício, independentemente das futuras tentativas de cobrança.",
          "operations": [
            {
              "table": "establishment_subscription",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "status"
              ],
              "why": "Procurar o vínculo pendente correspondente."
            },
            {
              "table": "establishment_subscription",
              "action": "Criar",
              "fields": [
                "id",
                "establishment_id",
                "status"
              ],
              "why": "Se necessário, criar a assinatura PENDING, sem activated_at."
            },
            {
              "table": "billing_order",
              "action": "Consultar",
              "fields": [
                "id",
                "subscription_id",
                "purpose",
                "benefit_key"
              ],
              "why": "Reutilizar a ordem inicial já existente para o mesmo benefício."
            },
            {
              "table": "billing_order",
              "action": "Criar",
              "fields": [
                "id",
                "establishment_id",
                "subscription_id",
                "purpose",
                "benefit_key",
                "target_cycle_id",
                "previous_cycle_id"
              ],
              "why": "Criar apenas se ausente: INITIAL; ciclos alvo e anterior ficam NULL."
            }
          ],
          "rules": [
            "01: uma ordem INITIAL por assinatura; benefit_key é única por estabelecimento.",
            "02: INITIAL exige target_cycle_id e previous_cycle_id nulos."
          ],
          "routine": "Gerar uma benefit_key estável. Consultar e criar de modo coordenado; em conflito de unicidade, recuperar o registro existente.",
          "branches": [],
          "transaction": null
        },
        {
          "id": "cobrar",
          "title": "Emitir a cobrança do benefício",
          "actor": "Backend · provedor",
          "domain": "financeiro",
          "result": "Cobrança OPEN com condições comerciais preservadas; o estabelecimento pode iniciar o pagamento.",
          "operations": [
            {
              "table": "billing_order",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "purpose"
              ],
              "why": "Usar a ordem da etapa anterior."
            },
            {
              "table": "subscription_plan",
              "action": "Consultar",
              "fields": [
                "id",
                "name",
                "description",
                "monthly_price",
                "volume_limit_liters",
                "collection_limit"
              ],
              "why": "Obter as condições para a nova cotação."
            },
            {
              "table": "billing_charge",
              "action": "Consultar",
              "fields": [
                "id",
                "billing_order_id",
                "status",
                "idempotency_key"
              ],
              "why": "Verificar cobrança equivalente ainda aberta."
            },
            {
              "table": "billing_charge",
              "action": "Criar",
              "fields": [
                "id",
                "billing_order_id",
                "establishment_id",
                "purpose",
                "plan_id",
                "plan_name",
                "plan_description",
                "quoted_monthly_price",
                "quoted_volume_limit_liters",
                "quoted_collection_limit",
                "amount",
                "provider",
                "idempotency_key",
                "status",
                "expires_at"
              ],
              "why": "Preservar cotação; INITIAL cobra a mensalidade integral."
            },
            {
              "table": "billing_charge",
              "action": "Atualizar",
              "fields": [
                "provider_charge_id",
                "updated_at"
              ],
              "why": "Associar a identificação externa quando o provedor responder."
            }
          ],
          "rules": [
            "01: OPEN e CANCELLATION_PENDING ocupam a vaga de cobrança aberta.",
            "02: INITIAL exige amount = quoted_monthly_price e currency = BRL."
          ],
          "routine": "Integrar com o provedor usando a mesma idempotency_key nas repetições da mesma tentativa. Uma nova emissão só ocorre após encerramento da anterior.",
          "branches": [
            {
              "condition": "Cobrança expira sem pagamento",
              "outcome": "Atualizar billing_charge para EXPIRED, com closed_at. Não liberar ciclo. Outra emissão usa a mesma ordem após confirmar o encerramento.",
              "journey": null,
              "target": "cobrar"
            },
            {
              "condition": "Falha de comunicação",
              "outcome": "Verificar o resultado da tentativa no provedor antes de repetir; não gerar outra chave para a mesma tentativa.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "receber",
          "title": "Verificar o pagamento recebido",
          "actor": "Estabelecimento · provedor · backend",
          "domain": "financeiro",
          "result": "Pagamento real identificado e verificado; a tela de sucesso do aplicativo não é confirmação suficiente.",
          "operations": [
            {
              "table": "billing_charge",
              "action": "Consultar",
              "fields": [
                "id",
                "billing_order_id",
                "establishment_id",
                "provider",
                "amount",
                "status"
              ],
              "why": "Relacionar o recebimento à cobrança e conferir os dados."
            },
            {
              "table": "payment",
              "action": "Consultar",
              "fields": [
                "id",
                "provider",
                "provider_payment_id"
              ],
              "why": "Identificar confirmações repetidas do mesmo recebimento."
            },
            {
              "table": "payment",
              "action": "Criar",
              "fields": [
                "id",
                "billing_charge_id",
                "billing_order_id",
                "establishment_id",
                "provider",
                "provider_payment_id",
                "amount",
                "currency",
                "paid_at",
                "verified_at"
              ],
              "why": "Registrar um novo recebimento real confirmado, se ainda não existir."
            },
            {
              "table": "billing_charge",
              "action": "Atualizar",
              "fields": [
                "status",
                "closed_at",
                "updated_at"
              ],
              "why": "Após confirmação válida, refletir a quitação com PAID e seu encerramento."
            }
          ],
          "rules": [
            "01: provider + provider_payment_id é único.",
            "02: pagamento positivo; paid_at ≤ verified_at ≤ created_at."
          ],
          "routine": "Verificar autenticidade, valor e correspondência da confirmação. O provedor e os meios aceitos ainda precisam ser escolhidos.",
          "branches": [
            {
              "condition": "Mesma confirmação chega novamente",
              "outcome": "Reutilizar payment existente; conferir a aplicação, sem conceder o benefício novamente.",
              "journey": null,
              "target": "aplicar"
            },
            {
              "condition": "Valor ou identidade incompatível",
              "outcome": "Não liberar benefício automaticamente. O material não define uma política geral para todas as divergências; exige tratamento da exceção.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "aplicar",
          "title": "Aplicar o pagamento e abrir o ciclo",
          "actor": "Backend · rotinas",
          "domain": "planos",
          "result": "Primeiro ciclo começa na liberação efetiva do acesso, com as condições cotadas.",
          "operations": [
            {
              "table": "payment",
              "action": "Consultar",
              "fields": [
                "id",
                "billing_order_id",
                "establishment_id",
                "amount"
              ],
              "why": "Usar o recebimento confirmado."
            },
            {
              "table": "billing_charge",
              "action": "Consultar",
              "fields": [
                "plan_id",
                "plan_name",
                "plan_description",
                "quoted_monthly_price",
                "quoted_volume_limit_liters",
                "quoted_collection_limit"
              ],
              "why": "Copiar as condições da cobrança, sem recotar o benefício pago."
            },
            {
              "table": "payment_application",
              "action": "Consultar",
              "fields": [
                "payment_id",
                "billing_order_id"
              ],
              "why": "Verificar se o pagamento ou o benefício já foi aplicado."
            },
            {
              "table": "subscription_cycle",
              "action": "Criar",
              "fields": [
                "id",
                "subscription_id",
                "establishment_id",
                "cycle_number",
                "starts_at",
                "ends_at",
                "anchor_day",
                "anchor_local_time",
                "anchor_timezone",
                "plan_id",
                "plan_name",
                "plan_description",
                "monthly_price",
                "volume_limit_liters",
                "collection_limit"
              ],
              "why": "Criar o mês contratado com as âncoras de calendário e os limites cotados."
            },
            {
              "table": "payment_application",
              "action": "Criar",
              "fields": [
                "id",
                "payment_id",
                "billing_order_id",
                "establishment_id",
                "purpose",
                "cycle_id",
                "applied_at"
              ],
              "why": "Vincular o pagamento ao novo ciclo com INITIAL."
            },
            {
              "table": "establishment_subscription",
              "action": "Atualizar",
              "fields": [
                "status",
                "activated_at",
                "updated_at"
              ],
              "why": "Ativar a assinatura na liberação do acesso."
            }
          ],
          "rules": [
            "01: payment_id e billing_order_id são individualmente únicos em payment_application.",
            "01: EXCLUDE impede ciclos sobrepostos; uma aplicação INITIAL/RENEWAL por ciclo.",
            "02: intervalo do ciclo deve ser finito e não vazio."
          ],
          "routine": "Calcular um mês civil, verificar titularidade e coordenar concorrência. Criar ciclo, aplicação e ativação como uma unidade consistente.",
          "branches": [
            {
              "condition": "O mesmo pagamento já foi aplicado",
              "outcome": "Retornar o benefício existente; não criar outro ciclo.",
              "journey": null,
              "target": null
            },
            {
              "condition": "Outro pagamento já atendeu a mesma ordem",
              "outcome": "O novo recebimento é excedente para esse benefício; seguir para reembolso integral.",
              "journey": "reembolso",
              "target": null
            }
          ],
          "transaction": "Confirmar criação do ciclo, aplicação e ativação juntos. Se uma parte falhar, não deixar acesso parcialmente liberado."
        },
        {
          "id": "acesso",
          "title": "Usar o período contratado",
          "actor": "Estabelecimento · backend",
          "domain": "b2b",
          "result": "O estabelecimento pode iniciar uma solicitação de coleta dentro das condições do seu ciclo.",
          "operations": [
            {
              "table": "establishment_subscription",
              "action": "Consultar",
              "fields": [
                "id",
                "status"
              ],
              "why": "Confirmar o vínculo ativo."
            },
            {
              "table": "subscription_cycle",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "starts_at",
                "ends_at",
                "volume_limit_liters",
                "collection_limit"
              ],
              "why": "Identificar o período e os limites para a jornada operacional."
            }
          ],
          "rules": [
            "01/02: status da assinatura e intervalo do ciclo são informações distintas."
          ],
          "routine": "A disponibilidade exige considerar solicitações, coletas e perdas; não basta olhar ACTIVE.",
          "branches": [
            {
              "condition": "Deseja solicitar uma coleta",
              "outcome": "Continuar para a jornada B2B e validar disponibilidade.",
              "journey": "coleta",
              "target": null
            }
          ],
          "transaction": null
        }
      ]
    },
    {
      "id": "coleta",
      "title": "Solicitar e realizar uma coleta",
      "profile": "B2B",
      "goal": "Da reserva de litros e vaga ao registro da visita, consumo e pontuação.",
      "prerequisite": "Estabelecimento autenticado. Um ciclo pago vigente é exigido para criar o pedido; pedidos antigos permanecem vinculados ao ciclo de origem.",
      "outcome": "Visita registrada com volume físico, resultado e pontos; reserva reconciliada no ciclo de origem.",
      "references": "Regras de Negócio, revisão 2: §§ 6–9, 10.6–10.7, 11 e 14; scripts 01 e 02.",
      "scope": "Caminho de uma visita realizada. Cancelamento e falha operacional aparecem como desvios; retirada de óleo acumulado por PEV não é definida aqui.",
      "steps": [
        {
          "id": "disponibilidade",
          "title": "Conferir o direito de solicitar",
          "actor": "Estabelecimento · backend",
          "domain": "planos",
          "result": "Ciclo de origem e disponibilidade identificados.",
          "operations": [
            {
              "table": "establishment_subscription",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "status"
              ],
              "why": "Confirmar assinatura do titular."
            },
            {
              "table": "subscription_cycle",
              "action": "Consultar",
              "fields": [
                "id",
                "subscription_id",
                "establishment_id",
                "starts_at",
                "ends_at",
                "volume_limit_liters",
                "collection_limit"
              ],
              "why": "Localizar o ciclo vigente e suas franquias."
            },
            {
              "table": "collection_request",
              "action": "Consultar",
              "fields": [
                "id",
                "subscription_cycle_id",
                "status",
                "estimated_volume_liters",
                "forfeited_volume_liters",
                "forfeited_collection_slots"
              ],
              "why": "Somar reservas abertas e perdas, sem contar pedidos atendidos como reservas novamente."
            },
            {
              "table": "collection",
              "action": "Consultar",
              "fields": [
                "collection_request_id",
                "collected_volume_liters",
                "record_status"
              ],
              "why": "Apurar o consumo associado aos pedidos do ciclo, conforme os registros vigentes."
            }
          ],
          "rules": [
            "Documento § 10.6: disponível = limite − consumo − reservas abertas − perdas.",
            "01: não há colunas de saldo disponível em subscription_cycle."
          ],
          "routine": "Apurar litros e vagas por ciclo. Uma prévia na tela deve ser revalidada ao registrar a solicitação.",
          "branches": [
            {
              "condition": "Sem ciclo vigente ou sem franquia suficiente",
              "outcome": "Não criar pedido. A contratação inicial tem jornada própria; renovação e upgrade seguem suas regras específicas.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "reservar",
          "title": "Registrar o pedido e comprometer a franquia",
          "actor": "Estabelecimento · backend",
          "domain": "b2b",
          "result": "Pedido PENDING já reserva a estimativa e uma vaga.",
          "operations": [
            {
              "table": "subscription_cycle",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "volume_limit_liters",
                "collection_limit"
              ],
              "why": "Revalidar disponibilidade na gravação com os pedidos e as coletas da etapa anterior."
            },
            {
              "table": "collection_request",
              "action": "Criar",
              "fields": [
                "id",
                "establishment_id",
                "subscription_cycle_id",
                "estimated_volume_liters",
                "status",
                "observation",
                "request_at",
                "idempotency_key"
              ],
              "why": "Registrar PENDING e a estimativa positiva no ciclo de origem. Reenvios reutilizam a mesma chave de idempotência."
            }
          ],
          "rules": [
            "02: estimated_volume_liters > 0.",
            "01: FK composta garante que pedido e ciclo tenham o mesmo titular."
          ],
          "routine": "Coordenar a consulta de disponibilidade e a criação do pedido para impedir reservas concorrentes dos mesmos recursos.",
          "branches": [],
          "transaction": "Validação final de disponibilidade + criação do pedido precisam ser coordenadas na mesma transação. Não há um contador de reserva separado para atualizar."
        },
        {
          "id": "aprovar",
          "title": "Aprovar e registrar o horário acordado",
          "actor": "Administrador · operação externa",
          "domain": "b2b",
          "result": "Pedido APPROVED com horário exato; logística continua organizada fora do sistema.",
          "operations": [
            {
              "table": "users",
              "action": "Consultar",
              "fields": [
                "id",
                "user_type",
                "status"
              ],
              "why": "Verificar o administrador autorizado."
            },
            {
              "table": "collection_request",
              "action": "Consultar",
              "fields": [
                "id",
                "status",
                "establishment_id"
              ],
              "why": "Analisar o pedido e seu estado atual."
            },
            {
              "table": "collection_request",
              "action": "Atualizar",
              "fields": [
                "status",
                "approved_by",
                "approved_at",
                "scheduled_at",
                "updated_at"
              ],
              "why": "Registrar aprovação e horário acordado."
            },
            {
              "table": "collection_schedule_history",
              "action": "Criar",
              "fields": [
                "id",
                "collection_request_id",
                "previous_scheduled_at",
                "new_scheduled_at",
                "agreed_at",
                "changed_by",
                "reason"
              ],
              "why": "Preservar o primeiro agendamento ou um reagendamento acordado."
            }
          ],
          "rules": [
            "02: APPROVED exige approved_at, approved_by e scheduled_at.",
            "01: a FK do aprovador exige perfil ADMIN."
          ],
          "routine": "Confirmar autorização e acordo; escrever agendamento e seu histórico de negócio juntos.",
          "branches": [
            {
              "condition": "Pedido rejeitado antes da visita",
              "outcome": "Atualizar collection_request.status para REJECTED e updated_at; liberar a reserva na apuração. Não criar collection.",
              "journey": null,
              "target": null
            },
            {
              "condition": "Estabelecimento solicita cancelamento",
              "outcome": "Atualizar collection_request com CANCELLED, autoria, iniciativa, motivo, datas e política. Gratuito até 4h antes inclusive; depois, avaliar perda e exceções de atraso de 1h/aceite. Não criar coleta fictícia.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "chegada",
          "title": "Identificar a visita e registrar a chegada",
          "actor": "Motorista sem login · backend",
          "domain": "b2b",
          "result": "Chegada e instante de registro preservados; aceite do atendimento é um marco separado.",
          "operations": [
            {
              "table": "user_qr_code",
              "action": "Consultar",
              "fields": [
                "user_id",
                "qr_token",
                "user_type"
              ],
              "why": "Resolver o QR vigente do estabelecimento usado no formulário."
            },
            {
              "table": "establishment",
              "action": "Consultar",
              "fields": [
                "id",
                "qr_token"
              ],
              "why": "Relacionar o formulário ao titular."
            },
            {
              "table": "driver",
              "action": "Consultar",
              "fields": [
                "id",
                "status"
              ],
              "why": "Identificar o motorista operacional."
            },
            {
              "table": "collection_request",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "status",
                "scheduled_at"
              ],
              "why": "Usar o pedido aprovado compatível com a visita."
            },
            {
              "table": "collection_request",
              "action": "Atualizar",
              "fields": [
                "arrived_at",
                "arrival_recorded_at",
                "arrival_driver_id",
                "service_accepted_at",
                "service_acceptance_recorded_at",
                "service_accepted_by",
                "updated_at"
              ],
              "why": "Gravar chegada; preencher o conjunto de aceite quando houver aceite do estabelecimento."
            }
          ],
          "rules": [
            "02: chegada exige motorista, marcos temporais e agendamento aprovado.",
            "02: aceite, quando registrado, pertence ao próprio estabelecimento."
          ],
          "routine": "Serializar chegada, cancelamento e aceite. Registro operacional não é prova independente de presença física.",
          "branches": [
            {
              "condition": "Visita não realizada por falha da operação",
              "outcome": "Não criar collection nem penalizar o estabelecimento. Preservar pedido e reserva para atendimento posterior, ou cancelar gratuitamente por falha operacional.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "classificar",
          "title": "Avaliar o óleo e calcular o resultado",
          "actor": "Motorista informa fatos · rotinas calculam",
          "domain": "b2b",
          "result": "Volumes, resultado, motivos e pontuação calculados antes da gravação consistente.",
          "operations": [
            {
              "table": "collection_request",
              "action": "Consultar",
              "fields": [
                "id",
                "estimated_volume_liters",
                "establishment_id"
              ],
              "why": "Comparar o volume recolhido à estimativa original."
            },
            {
              "table": "collection_failure_reason",
              "action": "Consultar",
              "fields": [
                "id",
                "code",
                "status"
              ],
              "why": "Identificar os motivos coerentes com os fatos."
            },
            {
              "table": "collection",
              "action": "Consultar",
              "fields": [
                "establishment_id",
                "result",
                "processing_order",
                "record_status"
              ],
              "why": "Considerar a sequência operacional para recorrência."
            },
            {
              "table": "point_calculation",
              "action": "Consultar",
              "fields": [
                "user_id",
                "is_current",
                "successful_collections_count",
                "balance_after"
              ],
              "why": "Usar a revisão vigente na apuração de pontos."
            },
            {
              "table": "establishment",
              "action": "Consultar",
              "fields": [
                "id",
                "points"
              ],
              "why": "Obter o saldo para o processamento coordenado."
            }
          ],
          "rules": [
            "Documento § 8: sucesso exige volume entre 90% e 110% inclusive, óleo aceitável e ausência de ocorrência comprometedora.",
            "02: recolhido ≤ apresentado; zero apresentado exige NOT_ASSESSED."
          ],
          "routine": "Derivar resultado, motivos e pontos. O cliente informa fatos; não escolhe livremente pontuação.",
          "branches": [
            {
              "condition": "Óleo recusado ou nenhum óleo apresentado em visita realizada",
              "outcome": "Continuar com coleta UNSUCCESSFUL, volume efetivamente recolhido (inclusive zero), explicação exigida e penalidade única de −50.",
              "journey": null,
              "target": "persistir"
            },
            {
              "condition": "Vários motivos de malsucesso",
              "outcome": "Registrar todos os motivos aplicáveis, sem multiplicar a penalidade.",
              "journey": null,
              "target": "persistir"
            }
          ],
          "transaction": null
        },
        {
          "id": "persistir",
          "title": "Gravar a coleta e seus efeitos",
          "actor": "Backend · rotinas",
          "domain": "pontos",
          "result": "Visita e cálculo persistidos; a vaga passa a consumida e a reserva é substituída pelo volume real.",
          "operations": [
            {
              "table": "collection",
              "action": "Criar",
              "fields": [
                "id",
                "collection_request_id",
                "establishment_id",
                "driver_id",
                "presented_volume_liters",
                "collected_volume_liters",
                "oil_condition",
                "has_compromising_occurrence",
                "result",
                "points_earned",
                "observation",
                "collection_date",
                "processing_order",
                "record_status",
                "revision"
              ],
              "why": "Registrar a visita já com valores derivados consistentes; uma coleta por pedido."
            },
            {
              "table": "collection_failure",
              "action": "Criar",
              "fields": [
                "collection_id",
                "failure_reason_id"
              ],
              "why": "Somente no malsucesso, associar os motivos aplicáveis sem repetição."
            },
            {
              "table": "point_calculation",
              "action": "Criar",
              "fields": [
                "id",
                "user_id",
                "collection_id",
                "delivery_pev_id",
                "revision",
                "is_current",
                "points_total",
                "balance_before",
                "balance_after",
                "successful_collections_count"
              ],
              "why": "Criar a revisão inicial B2B; delivery_pev_id fica NULL."
            },
            {
              "table": "point_transaction",
              "action": "Criar",
              "fields": [
                "id",
                "point_calculation_id",
                "component",
                "points"
              ],
              "why": "Registrar os componentes do cálculo."
            },
            {
              "table": "establishment",
              "action": "Atualizar",
              "fields": [
                "points"
              ],
              "why": "Atualizar o saldo derivado; piso zero é aplicado por evento."
            }
          ],
          "rules": [
            "01: collection_request_id é único; FK da coleta exige pedido APPROVED.",
            "02: malsucesso vigente = −50; cálculo aplica piso zero ao saldo.",
            "Documento § 10.7: consumo permanece no ciclo de origem do pedido."
          ],
          "routine": "Persistir resultado, motivos, componentes e saldo de forma atômica. Na apuração, pedidos atendidos deixam de ser reservas; não criar um segundo desconto.",
          "branches": [
            {
              "condition": "Volume real ultrapassa a franquia",
              "outcome": "Registrar a visita e o consumo reais mesmo assim. Bloquear novos pedidos incompatíveis; não cobrar excedentes automaticamente.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": "Resultado, motivos, revisão de pontos, componentes e saldo são confirmados juntos. Não criar collection com campos obrigatórios provisoriamente incoerentes."
        },
        {
          "id": "resultado",
          "title": "Consultar consumo e reconhecimento",
          "actor": "Backend · estabelecimento",
          "domain": "pontos",
          "result": "Volume real sustenta indicadores e, se houver metas configuradas, avaliação de certificados.",
          "operations": [
            {
              "table": "collection",
              "action": "Consultar",
              "fields": [
                "establishment_id",
                "collected_volume_liters",
                "collection_date",
                "record_status"
              ],
              "why": "Usar volume recolhido vigente, inclusive de visitas malsucedidas, na data física."
            },
            {
              "table": "collection_request",
              "action": "Consultar",
              "fields": [
                "subscription_cycle_id",
                "estimated_volume_liters",
                "status",
                "forfeited_volume_liters",
                "forfeited_collection_slots"
              ],
              "why": "Relacionar consumo ao ciclo e separar reservas e perdas."
            },
            {
              "table": "subscription_cycle",
              "action": "Consultar",
              "fields": [
                "id",
                "volume_limit_liters",
                "collection_limit"
              ],
              "why": "Reapurar o disponível, sem escrever contadores inexistentes."
            },
            {
              "table": "certificate_level",
              "action": "Consultar",
              "fields": [
                "id",
                "required_liters"
              ],
              "why": "Avaliar metas somente quando configuradas."
            },
            {
              "table": "certificate",
              "action": "Consultar",
              "fields": [
                "id",
                "establishment_id",
                "certificate_level_id",
                "status"
              ],
              "why": "Verificar concessão existente por estabelecimento e nível."
            },
            {
              "table": "certificate",
              "action": "Criar",
              "fields": [
                "id",
                "establishment_id",
                "certificate_level_id",
                "certificate_code",
                "status"
              ],
              "why": "Condicional: conceder se a meta for atingida e ainda não houver registro."
            },
            {
              "table": "certificate",
              "action": "Atualizar",
              "fields": [
                "status",
                "reactivated_at",
                "status_reason",
                "updated_at"
              ],
              "why": "Condicional: reativar o registro revogado quando cabível, preservando sua identidade."
            }
          ],
          "rules": [
            "01: uma concessão por estabelecimento e nível.",
            "Documento § 11: certificados são independentes de plano e pontos."
          ],
          "routine": "Somar o volume oficial e avaliar metas. Nomes e metas ainda dependem de configuração; não inserir níveis fictícios.",
          "branches": [],
          "transaction": null
        }
      ]
    },
    {
      "id": "entrega",
      "title": "Entregar óleo em um PEV",
      "profile": "B2C",
      "goal": "Da identificação do cidadão à entrega aceita e sua pontuação.",
      "prerequisite": "Cidadão cadastrado com QR vigente e PEV aprovado, operado pelo próprio responsável autorizado.",
      "outcome": "Entrega aceita registrada com cidadão, PEV e validador; pontuação por litros completos.",
      "references": "Regras de Negócio, revisão 2: §§ 3, 5 e 9.1–9.2; scripts 01 e 02.",
      "scope": "Sem solicitação de caminhão, plano ou cobrança de PEV. Recusa total não gera uma entrega inválida.",
      "steps": [
        {
          "id": "identificar",
          "title": "Identificar o cidadão pelo QR",
          "actor": "Cidadão · responsável do PEV",
          "domain": "cadastros",
          "result": "Cidadão identificado para a entrega presencial.",
          "operations": [
            {
              "table": "user_qr_code",
              "action": "Consultar",
              "fields": [
                "user_id",
                "qr_token",
                "user_type"
              ],
              "why": "Resolver o token vigente do cidadão."
            },
            {
              "table": "citizens",
              "action": "Consultar",
              "fields": [
                "id",
                "qr_token",
                "points"
              ],
              "why": "Identificar o cidadão e seu saldo atual."
            }
          ],
          "rules": [
            "01: QR é globalmente único; citizens referencia token e perfil compatíveis."
          ],
          "routine": "Validar o token e o cadastro; possuir o QR do cidadão não concede autorização para validar uma entrega.",
          "branches": [
            {
              "condition": "QR inválido ou cidadão não identificado",
              "outcome": "Interromper o registro até identificar corretamente o participante.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "validar",
          "title": "Conferir o PEV e seu responsável",
          "actor": "Responsável autenticado · backend",
          "domain": "b2c",
          "result": "PEV aprovado e pessoa autorizada a validar a entrega confirmados.",
          "operations": [
            {
              "table": "pev",
              "action": "Consultar",
              "fields": [
                "id",
                "status",
                "citizen_id",
                "establishment_id"
              ],
              "why": "Verificar APPROVED e qual usuário é seu responsável."
            },
            {
              "table": "users",
              "action": "Consultar",
              "fields": [
                "id",
                "status",
                "user_type"
              ],
              "why": "Confirmar a identidade autenticada do responsável que será validated_by."
            }
          ],
          "rules": [
            "02: PEV possui exatamente um responsável, cidadão ou estabelecimento.",
            "Documento § 3: o próprio responsável registra e valida; is_pev não substitui consultar o PEV."
          ],
          "routine": "Validar aprovação e autoria no ato. A FK de validated_by exige usuário existente, mas não comprova que ele é o responsável do PEV.",
          "branches": [
            {
              "condition": "PEV inativo, pendente, rejeitado ou validador não autorizado",
              "outcome": "Não registrar a entrega válida.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "avaliar",
          "title": "Medir somente o volume aceito",
          "actor": "Responsável do PEV",
          "domain": "b2c",
          "result": "Quantidade efetivamente aceita definida; ainda não há registro de entrega.",
          "operations": [
            {
              "table": "pev",
              "action": "Consultar",
              "fields": [
                "id",
                "status"
              ],
              "why": "Manter o contexto do ponto aprovado durante a validação."
            }
          ],
          "rules": [
            "Documento § 5 e CHECK de volume: entrega B2C representa somente óleo aceito positivo."
          ],
          "routine": "Avaliar o material e medir o volume aceito. Não inventar volume estimado nem apresentado no cadastro B2C.",
          "branches": [
            {
              "condition": "Nenhum óleo aceito ou nenhuma entrega",
              "outcome": "Encerrar sem criar delivery_pev e sem penalidade ao cidadão.",
              "journey": null,
              "target": null
            },
            {
              "condition": "Parte do óleo foi recusada",
              "outcome": "Continuar com somente a quantidade aceita positiva.",
              "journey": null,
              "target": "registrar"
            }
          ],
          "transaction": null
        },
        {
          "id": "registrar",
          "title": "Registrar a entrega e calcular os pontos",
          "actor": "Responsável informa volume · backend grava",
          "domain": "pontos",
          "result": "Entrega, cálculo e saldo persistidos de forma consistente.",
          "operations": [
            {
              "table": "citizens",
              "action": "Consultar",
              "fields": [
                "id",
                "points"
              ],
              "why": "Obter e coordenar o saldo para a gravação."
            },
            {
              "table": "delivery_pev",
              "action": "Criar",
              "fields": [
                "id",
                "citizen_id",
                "pev_id",
                "validated_by",
                "oil_volume_liters",
                "points_earned",
                "delivery_date",
                "record_status",
                "revision",
                "idempotency_key"
              ],
              "why": "Registrar volume aceito, autor, data física, RECORDED e revisão inicial. Reenvios reutilizam a mesma chave de idempotência."
            },
            {
              "table": "point_calculation",
              "action": "Criar",
              "fields": [
                "id",
                "user_id",
                "collection_id",
                "delivery_pev_id",
                "revision",
                "is_current",
                "points_total",
                "balance_before",
                "balance_after"
              ],
              "why": "Criar revisão B2C; collection_id fica NULL."
            },
            {
              "table": "point_transaction",
              "action": "Criar",
              "fields": [
                "id",
                "point_calculation_id",
                "component",
                "points"
              ],
              "why": "Registrar o componente VOLUME."
            },
            {
              "table": "citizens",
              "action": "Atualizar",
              "fields": [
                "points"
              ],
              "why": "Atualizar saldo derivado dos litros completos."
            }
          ],
          "rules": [
            "02: points_earned = FLOOR(oil_volume_liters) para entrega RECORDED.",
            "02: point_calculation tem exatamente uma origem: coleta ou entrega."
          ],
          "routine": "Calcular pontos, verificar novamente a autorização e coordenar gravação e saldo; não aceitar pontos arbitrários do cliente.",
          "branches": [
            {
              "condition": "Volume aceito inferior a 1 L",
              "outcome": "Registrar a entrega positiva normalmente, com zero pontos. Não descartar o registro por não pontuar.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": "Entrega + cálculo + componente + saldo devem ser confirmados juntos, sem saldo atualizado com entrega ausente."
        },
        {
          "id": "consultar",
          "title": "Exibir a entrega e o saldo",
          "actor": "Cidadão · backend",
          "domain": "b2c",
          "result": "Histórico de entregas e pontuação disponíveis para consulta.",
          "operations": [
            {
              "table": "delivery_pev",
              "action": "Consultar",
              "fields": [
                "id",
                "citizen_id",
                "pev_id",
                "oil_volume_liters",
                "points_earned",
                "delivery_date",
                "record_status"
              ],
              "why": "Exibir o fato registrado e o volume aceito."
            },
            {
              "table": "citizens",
              "action": "Consultar",
              "fields": [
                "id",
                "points"
              ],
              "why": "Exibir o saldo persistente."
            },
            {
              "table": "point_calculation",
              "action": "Consultar",
              "fields": [
                "delivery_pev_id",
                "is_current",
                "points_total"
              ],
              "why": "Consultar a revisão vigente quando necessário."
            }
          ],
          "rules": [
            "Documento §§ 9 e 11: B2C não recebe bônus/penalidade B2B nem certificados destinados a estabelecimentos."
          ],
          "routine": "Redis pode refletir o ranking; PostgreSQL continua como fonte de verdade. A estratégia de sincronização não é especificada por estes scripts.",
          "branches": [
            {
              "condition": "Entrega foi registrada incorretamente",
              "outcome": "Correção/anulação administrativa é outro processo, com revisão e recálculo. Não excluir a linha para simular recusa.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        }
      ]
    },
    {
      "id": "reembolso",
      "title": "Devolver um pagamento elegível",
      "profile": "Processo compartilhado · financeiro B2B",
      "goal": "Do recebimento excedente ou upgrade expirado à devolução integral confirmada.",
      "prerequisite": "Pagamento real verificado, associado à cobrança e à ordem comercial.",
      "outcome": "Pagamento preservado e reembolso integral concluído, ou pendência explícita para acompanhamento.",
      "references": "Regras de Negócio, revisão 2: §§ 10.9 e 10.12; scripts 01 e 02.",
      "scope": "Somente DUPLICATE_BENEFIT e EXPIRED_UPGRADE. Não é reembolso genérico por cancelamento de coleta ou correção operacional.",
      "steps": [
        {
          "id": "elegibilidade",
          "title": "Identificar um motivo previsto",
          "actor": "Backend · rotinas",
          "domain": "financeiro",
          "result": "Motivo validado para este pagamento, sem confundir mensagem repetida com novo recebimento.",
          "operations": [
            {
              "table": "payment",
              "action": "Consultar",
              "fields": [
                "id",
                "provider",
                "provider_payment_id",
                "billing_order_id",
                "amount"
              ],
              "why": "Distinguir pagamentos reais por identidade externa."
            },
            {
              "table": "billing_order",
              "action": "Consultar",
              "fields": [
                "id",
                "purpose",
                "target_cycle_id"
              ],
              "why": "Identificar benefício e, no upgrade, ciclo alvo."
            },
            {
              "table": "billing_charge",
              "action": "Consultar",
              "fields": [
                "id",
                "billing_order_id",
                "purpose",
                "target_cycle_id",
                "amount"
              ],
              "why": "Recuperar o contexto da cobrança."
            },
            {
              "table": "payment_application",
              "action": "Consultar",
              "fields": [
                "payment_id",
                "billing_order_id",
                "cycle_id"
              ],
              "why": "Verificar qual pagamento já atendeu o benefício e se este upgrade já foi aplicado."
            },
            {
              "table": "subscription_cycle",
              "action": "Consultar",
              "fields": [
                "id",
                "ends_at"
              ],
              "why": "No upgrade ainda não aplicado, verificar se é possível aplicá-lo antes do término."
            }
          ],
          "rules": [
            "01: motivos permitidos são DUPLICATE_BENEFIT e EXPIRED_UPGRADE.",
            "Documento § 10.9: confirmação tardia de upgrade não estende ciclo nem gera outro período."
          ],
          "routine": "Coordenar aplicação e reembolso. As FKs não impedem sozinhas que um pagamento apareça nas duas tabelas.",
          "branches": [
            {
              "condition": "Reenvio da mesma confirmação",
              "outcome": "Não criar outro pagamento nem reembolso: recuperar o resultado já processado.",
              "journey": null,
              "target": null
            },
            {
              "condition": "Outro pagamento já atendeu a mesma ordem",
              "outcome": "Classificar este recebimento excedente como DUPLICATE_BENEFIT e seguir.",
              "journey": null,
              "target": "solicitar"
            },
            {
              "condition": "Upgrade não aplicado e ciclo encerrado",
              "outcome": "Classificar como EXPIRED_UPGRADE, inclusive quando o pagamento ocorreu antes, mas a confirmação chegou tarde.",
              "journey": null,
              "target": "solicitar"
            },
            {
              "condition": "Nenhum dos dois motivos se aplica",
              "outcome": "Não presumir direito a reembolso automático. Outras situações exigem definição ou tratamento da exceção.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "solicitar",
          "title": "Registrar a devolução integral",
          "actor": "Backend",
          "domain": "financeiro",
          "result": "Uma solicitação REQUESTED fica vinculada ao pagamento original.",
          "operations": [
            {
              "table": "payment_refund",
              "action": "Consultar",
              "fields": [
                "id",
                "payment_id",
                "status",
                "idempotency_key"
              ],
              "why": "Reutilizar a devolução existente em vez de criar outra."
            },
            {
              "table": "payment_refund",
              "action": "Criar",
              "fields": [
                "id",
                "payment_id",
                "reason",
                "amount",
                "provider",
                "status",
                "idempotency_key",
                "requested_at"
              ],
              "why": "Criar somente se ausente, com valor e provedor iguais aos do pagamento."
            }
          ],
          "rules": [
            "01: payment_id é único no reembolso.",
            "01: FK (payment_id, amount, provider) exige correspondência integral."
          ],
          "routine": "Registrar uma única decisão de devolução para o pagamento; gerar e preservar a chave da operação.",
          "branches": [
            {
              "condition": "Já existe solicitação",
              "outcome": "Acompanhar o estado existente; não gerar outra chave nem duplicar a devolução.",
              "journey": null,
              "target": "acompanhar"
            }
          ],
          "transaction": "Decisão de não aplicar este pagamento e registro do reembolso precisam ser coordenados para evitar concessão e devolução incompatíveis."
        },
        {
          "id": "enviar",
          "title": "Solicitar a devolução ao provedor",
          "actor": "Backend · provedor",
          "domain": "financeiro",
          "result": "Operação externa solicitada com a identidade estável do reembolso.",
          "operations": [
            {
              "table": "payment_refund",
              "action": "Consultar",
              "fields": [
                "id",
                "payment_id",
                "provider",
                "amount",
                "idempotency_key",
                "status"
              ],
              "why": "Carregar a solicitação e sua chave."
            },
            {
              "table": "payment",
              "action": "Consultar",
              "fields": [
                "id",
                "provider_payment_id"
              ],
              "why": "Identificar o recebimento no provedor."
            },
            {
              "table": "payment_refund",
              "action": "Atualizar",
              "fields": [
                "status",
                "provider_refund_id"
              ],
              "why": "Refletir processamento e identificação externa quando disponíveis."
            }
          ],
          "rules": [
            "02: estados diferentes de COMPLETED mantêm completed_at nulo."
          ],
          "routine": "Enviar a solicitação com a mesma chave nas repetições. Uma transação SQL não desfaz uma operação já aceita pelo provedor.",
          "branches": [
            {
              "condition": "Resposta de rede incerta",
              "outcome": "Consultar o resultado no provedor antes de tentar novamente. Não presumir que a operação falhou.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "acompanhar",
          "title": "Confirmar conclusão ou preservar a pendência",
          "actor": "Provedor · backend",
          "domain": "financeiro",
          "result": "COMPLETED somente após confirmação; falhas permanecem rastreáveis.",
          "operations": [
            {
              "table": "payment_refund",
              "action": "Consultar",
              "fields": [
                "id",
                "status",
                "provider_refund_id",
                "idempotency_key"
              ],
              "why": "Localizar a solicitação ao receber ou consultar o resultado."
            },
            {
              "table": "payment_refund",
              "action": "Atualizar",
              "fields": [
                "status",
                "completed_at",
                "provider_refund_id",
                "last_error",
                "next_attempt_at"
              ],
              "why": "Concluir quando confirmado; se houver falha, registrar FAILED e acompanhamento quando aplicável."
            }
          ],
          "rules": [
            "02: somente COMPLETED tem completed_at, que não antecede requested_at."
          ],
          "routine": "Verificar o resultado real. Intervalo e limite de repetição não estão definidos no material; o fluxo não inventa prazos.",
          "branches": [
            {
              "condition": "Falha recuperável",
              "outcome": "Programar nova tentativa conforme a política a implementar, preservando a chave e o pagamento.",
              "journey": null,
              "target": "enviar"
            },
            {
              "condition": "Exceção que o sistema não resolve",
              "outcome": "Administrador acompanha a resolução; não marcar como concluído sem confirmação.",
              "journey": null,
              "target": null
            }
          ],
          "transaction": null
        },
        {
          "id": "concluir",
          "title": "Consultar o resultado financeiro",
          "actor": "Backend · estabelecimento",
          "domain": "financeiro",
          "result": "Recebimento original preservado, com a situação da devolução associada.",
          "operations": [
            {
              "table": "payment",
              "action": "Consultar",
              "fields": [
                "id",
                "amount",
                "paid_at"
              ],
              "why": "Preservar o fato de que o dinheiro foi recebido."
            },
            {
              "table": "payment_refund",
              "action": "Consultar",
              "fields": [
                "payment_id",
                "reason",
                "amount",
                "status",
                "completed_at"
              ],
              "why": "Exibir o resultado ou a pendência da devolução."
            },
            {
              "table": "payment_application",
              "action": "Consultar",
              "fields": [
                "billing_order_id",
                "payment_id",
                "cycle_id"
              ],
              "why": "No benefício duplicado, manter a concessão legítima financiada pelo outro pagamento."
            }
          ],
          "rules": [
            "Documento § 10.12: não converter automaticamente o valor em crédito ou outro ciclo."
          ],
          "routine": "Não excluir o pagamento devolvido, não duplicar benefício e não reiniciar período como substituto do reembolso.",
          "branches": [],
          "transaction": null
        }
      ]
    },
    {
      "id": "administradores",
      "title": "Convidar e gerenciar ADMIN",
      "profile": "Identidade e acesso",
      "goal": "Do convite ao novo administrador, preservando pelo menos um ADMIN ativo.",
      "prerequisite": "ADMIN ativo autenticado. Primeiro convite: operador de implantação e ausência de qualquer ADMIN, inclusive inativo.",
      "outcome": "Conta criada somente no aceite; convite consumido e mudanças auditadas.",
      "references": "Scripts atuais 01–05 e access_control/01_roles.sql; contrato administrativo aprovado.",
      "scope": "Fluxo documental. Tokens originais e senhas não são exemplos de dados desta página.",
      "steps": [
        {
          "id": "emitir",
          "title": "Emitir ou reenviar o convite",
          "actor": "Core API · PostgreSQL",
          "domain": "cadastros",
          "result": "Convite válido por 24 horas; reenvio revoga o anterior do mesmo e-mail.",
          "operations": [
            {
              "table": "users",
              "action": "Consultar",
              "fields": [
                "id",
                "user_type",
                "status",
                "email"
              ],
              "why": "Validar autor ativo e impedir promoção de e-mail já cadastrado."
            },
            {
              "table": "admin_invitation",
              "action": "Criar",
              "fields": [
                "id",
                "name",
                "email",
                "token_hash",
                "issued_at",
                "expires_at",
                "invited_by",
                "is_bootstrap"
              ],
              "why": "Persistir somente o hash SHA-256 do segredo gerado pela Core."
            },
            {
              "table": "admin_invitation",
              "action": "Atualizar",
              "fields": [
                "revoked_at",
                "revoked_by"
              ],
              "why": "Invalidar o convite anterior no reenvio."
            }
          ],
          "rules": [
            "issue_admin_invitation exige autor ADMIN ativo.",
            "Bootstrap não é endpoint público e encerra quando existir qualquer ADMIN."
          ],
          "routine": "Core gera segredo seguro e envia e-mail após commit. Banco usa issue_admin_invitation ou bootstrap restrito.",
          "branches": [],
          "transaction": "Emissão, revogação anterior e auditoria são atômicas."
        },
        {
          "id": "aceitar",
          "title": "Aceitar e definir a senha",
          "actor": "Core API · PostgreSQL",
          "domain": "cadastros",
          "result": "Usuário ACTIVE/ADMIN criado sem login automático.",
          "operations": [
            {
              "table": "admin_invitation",
              "action": "Consultar",
              "fields": [
                "token_hash",
                "expires_at",
                "accepted_at",
                "revoked_at",
                "invited_by",
                "is_bootstrap"
              ],
              "why": "Validar segredo, prazo, uso, revogação e emissor ainda ativo."
            },
            {
              "table": "users",
              "action": "Criar",
              "fields": [
                "id",
                "name",
                "email",
                "password_hash",
                "user_type",
                "status"
              ],
              "why": "Usar nome/e-mail do convite e hash de senha calculado pela Core."
            },
            {
              "table": "admin_invitation",
              "action": "Atualizar",
              "fields": [
                "accepted_at",
                "accepted_user_id"
              ],
              "why": "Consumir o convite uma única vez e vincular a conta criada."
            }
          ],
          "rules": [
            "Sem promoção automática de conta existente.",
            "Aceites simultâneos não criam duas contas."
          ],
          "routine": "accept_admin_invitation; Core valida a senha e não registra os segredos nos logs.",
          "branches": [],
          "transaction": "Criação, aceite e auditoria confirmam juntos ou são revertidos."
        },
        {
          "id": "revogar",
          "title": "Revogar um convite pendente",
          "actor": "Core API · PostgreSQL",
          "domain": "cadastros",
          "result": "Convite não aceito perde a possibilidade de uso.",
          "operations": [
            {
              "table": "users",
              "action": "Consultar",
              "fields": [
                "id",
                "user_type",
                "status"
              ],
              "why": "Confirmar ADMIN autor ativo."
            },
            {
              "table": "admin_invitation",
              "action": "Atualizar",
              "fields": [
                "revoked_at",
                "revoked_by"
              ],
              "why": "Marcar revogação sem apagar o registro."
            }
          ],
          "rules": [
            "Convite aceito não pode ser revogado."
          ],
          "routine": "revoke_admin_invitation; chamada repetida não reabre o convite.",
          "branches": [],
          "transaction": null
        },
        {
          "id": "status",
          "title": "Gerenciar status administrativo",
          "actor": "Core API · PostgreSQL",
          "domain": "cadastros",
          "result": "Inativação preserva outro ADMIN ativo e revoga as sessões da conta.",
          "operations": [
            {
              "table": "users",
              "action": "Consultar",
              "fields": [
                "id",
                "user_type",
                "status"
              ],
              "why": "Validar autor e verificar os demais administradores."
            },
            {
              "table": "users",
              "action": "Atualizar",
              "fields": [
                "status",
                "updated_at"
              ],
              "why": "Ativar/inativar por set_admin_status."
            },
            {
              "table": "auth_session",
              "action": "Atualizar",
              "fields": [
                "revoked_at",
                "revocation_reason",
                "updated_at"
              ],
              "why": "Revogar sessões na inativação pelo mecanismo existente."
            }
          ],
          "rules": [
            "Último ADMIN ativo não pode ser inativado, excluído ou perder o perfil.",
            "A proteção também vale sob concorrência."
          ],
          "routine": "set_admin_status e triggers de users. A linha técnica de coordenação fica fora do diagrama.",
          "branches": [],
          "transaction": null
        }
      ]
    },
    {
      "id": "autenticacao",
      "title": "Abrir, renovar e encerrar sessão",
      "profile": "Identidade e acesso",
      "goal": "Relacionar usuário, sessão por dispositivo e rotação dos tokens de renovação.",
      "prerequisite": "Core verifica credenciais e status, gera segredos e chama as funções autorizadas.",
      "outcome": "Sessão validada no banco; tokens consumidos são preservados para detectar reutilização.",
      "references": "Scripts atuais 01–05 e access_control/01_roles.sql; contrato administrativo aprovado.",
      "scope": "Fluxo documental. Tokens originais e senhas não são exemplos de dados desta página.",
      "steps": [
        {
          "id": "login",
          "title": "Abrir a sessão",
          "actor": "Core API · PostgreSQL",
          "domain": "cadastros",
          "result": "Sessão e primeira geração do refresh registradas.",
          "operations": [
            {
              "table": "users",
              "action": "Consultar",
              "fields": [
                "id",
                "password_hash",
                "status"
              ],
              "why": "Core confere credenciais e usuário ativo."
            },
            {
              "table": "auth_session",
              "action": "Criar",
              "fields": [
                "id",
                "user_id",
                "created_at",
                "last_renewed_at",
                "idle_expires_at",
                "updated_at"
              ],
              "why": "Representar um login independente por dispositivo."
            },
            {
              "table": "auth_refresh_token",
              "action": "Criar",
              "fields": [
                "id",
                "session_id",
                "token_hash",
                "generation",
                "issued_at",
                "expires_at"
              ],
              "why": "Armazenar hash, geração e prazo; nunca o segredo original."
            }
          ],
          "rules": [
            "JWT não é armazenado nessas tabelas."
          ],
          "routine": "Core emite credenciais e utiliza as funções de sessão; não escreve livremente nas tabelas.",
          "branches": [],
          "transaction": null
        },
        {
          "id": "rotacao",
          "title": "Renovar com rotação",
          "actor": "Core API · PostgreSQL",
          "domain": "cadastros",
          "result": "Token anterior consumido e nova geração emitida na mesma sessão.",
          "operations": [
            {
              "table": "auth_session",
              "action": "Consultar",
              "fields": [
                "id",
                "user_id",
                "idle_expires_at",
                "revoked_at"
              ],
              "why": "Verificar sessão válida e titular ativo."
            },
            {
              "table": "auth_refresh_token",
              "action": "Atualizar",
              "fields": [
                "consumed_at"
              ],
              "why": "Consumir somente o token válido apresentado."
            },
            {
              "table": "auth_refresh_token",
              "action": "Criar",
              "fields": [
                "id",
                "session_id",
                "token_hash",
                "generation",
                "issued_at",
                "expires_at"
              ],
              "why": "Persistir o hash da nova geração."
            },
            {
              "table": "auth_session",
              "action": "Atualizar",
              "fields": [
                "last_renewed_at",
                "idle_expires_at",
                "updated_at"
              ],
              "why": "Registrar renovação bem-sucedida."
            }
          ],
          "rules": [
            "No máximo um refresh não consumido por sessão; isso não garante que esteja válido.",
            "Reutilização detectada revoga a sessão; conservar tokens consumidos."
          ],
          "routine": "Rotinas de autenticação controlam concorrência e reutilização; Core entrega o novo segredo apenas no sucesso.",
          "branches": [],
          "transaction": "Consumo e nova geração são coordenados pelo banco."
        },
        {
          "id": "encerrar",
          "title": "Encerrar ou revogar",
          "actor": "Core API · PostgreSQL",
          "domain": "cadastros",
          "result": "Sessão deixa de autorizar novas operações e renovações.",
          "operations": [
            {
              "table": "auth_session",
              "action": "Atualizar",
              "fields": [
                "revoked_at",
                "revocation_reason",
                "updated_at"
              ],
              "why": "Logout, conta inativa ou reutilização de refresh revogam a sessão."
            },
            {
              "table": "users",
              "action": "Consultar",
              "fields": [
                "id",
                "status"
              ],
              "why": "Verificar conta ativa juntamente com a sessão."
            }
          ],
          "rules": [
            "Consultas comuns não prorrogam o prazo da sessão."
          ],
          "routine": "Core valida sessão/usuário, além da assinatura do JWT.",
          "branches": [],
          "transaction": null
        }
      ]
    }
  ]
}
`;

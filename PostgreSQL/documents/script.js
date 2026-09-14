// Dados documentais extraídos dos scripts SQL e das jornadas revisadas.
// Mantidos neste arquivo para permitir abrir o HTML sem servidor.
const MODEL = {
  "tables": {
    "users": {
      "name": "users",
      "domain": "cadastros",
      "description": "Usuários autenticados. Driver não possui login. Inativar para preservar histórico.",
      "columns": [
        {
          "name": "id",
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "VARCHAR(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "name VARCHAR(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "email",
          "type": "VARCHAR(255)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "email VARCHAR(255) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "password_hash",
          "type": "VARCHAR(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "password_hash VARCHAR(255) NOT NULL",
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
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "name VARCHAR(100) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "VARCHAR(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "description VARCHAR(255)",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
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
          "definition": "owner_kind address_owner_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "state",
          "type": "CHAR(2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "state CHAR(2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "city",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "city VARCHAR(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "neighborhood",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "neighborhood VARCHAR(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "street",
          "type": "VARCHAR(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "street VARCHAR(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "number",
          "type": "VARCHAR(20)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "number VARCHAR(20) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "cep",
          "type": "CHAR(8)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "cep CHAR(8) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "complement",
          "type": "VARCHAR(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "complement VARCHAR(150)",
          "description": "",
          "fk": []
        },
        {
          "name": "latitude",
          "type": "DECIMAL(9,6)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "latitude DECIMAL(9,6)",
          "description": "",
          "fk": []
        },
        {
          "name": "longitude",
          "type": "DECIMAL(9,6)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "longitude DECIMAL(9,6)",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "telephone",
          "type": "VARCHAR(20)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "telephone VARCHAR(20) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "user_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "user_id UUID NOT NULL",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "user_id UUID PRIMARY KEY",
          "description": "",
          "fk": [
            "fk_user_qr_type"
          ]
        },
        {
          "name": "qr_token",
          "type": "VARCHAR(64)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "qr_token VARCHAR(64) NOT NULL UNIQUE",
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
          "definition": "user_type user_type_t NOT NULL",
          "description": "",
          "fk": [
            "fk_user_qr_type"
          ]
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY",
          "description": "",
          "fk": [
            "fk_citizens_user_type",
            "fk_citizens_qr"
          ]
        },
        {
          "name": "cpf",
          "type": "CHAR(11)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "cpf CHAR(11) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "user_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "CITIZENS",
          "nullable": false,
          "definition": "user_type user_type_t GENERATED ALWAYS AS ('CITIZENS'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_citizens_user_type"
          ]
        },
        {
          "name": "qr_token",
          "type": "VARCHAR(64)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "qr_token VARCHAR(64) NOT NULL",
          "description": "",
          "fk": [
            "fk_citizens_qr"
          ]
        },
        {
          "name": "points",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "points BIGINT NOT NULL DEFAULT 0",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY",
          "description": "",
          "fk": [
            "fk_establishment_user_type",
            "fk_establishment_qr"
          ]
        },
        {
          "name": "cnpj",
          "type": "CHAR(14)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "cnpj CHAR(14) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "user_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "ESTABLISHMENT",
          "nullable": false,
          "definition": "user_type user_type_t GENERATED ALWAYS AS ('ESTABLISHMENT'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_establishment_user_type"
          ]
        },
        {
          "name": "qr_token",
          "type": "VARCHAR(64)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "qr_token VARCHAR(64) NOT NULL",
          "description": "",
          "fk": [
            "fk_establishment_qr"
          ]
        },
        {
          "name": "points",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "points BIGINT NOT NULL DEFAULT 0",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "description TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "is_pev",
          "type": "BOOLEAN",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "is_pev BOOLEAN NOT NULL DEFAULT FALSE",
          "description": "Derivado do PEV APPROVED; sincronizar na mesma transação, sem edição independente.",
          "fk": []
        },
        {
          "name": "type_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "type_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_establishment_type"
          ]
        },
        {
          "name": "address_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "address_id UUID NOT NULL UNIQUE",
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
          "generated": "ESTABLISHMENT",
          "nullable": false,
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "VARCHAR(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "name VARCHAR(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "cpf",
          "type": "CHAR(11)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "cpf CHAR(11) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "cnh",
          "type": "CHAR(11)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "cnh CHAR(11) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "registration_date",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "registration_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
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
          "definition": "status approval_status_t NOT NULL DEFAULT 'PENDING'",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "approved_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "approved_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "approved_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "approved_by UUID",
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
          "generated": "ADMIN",
          "nullable": false,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_pev_admin"
          ]
        },
        {
          "name": "citizen_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": true,
          "definition": "citizen_id UUID UNIQUE",
          "description": "",
          "fk": [
            "fk_pev_citizen"
          ]
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": true,
          "definition": "establishment_id UUID UNIQUE",
          "description": "",
          "fk": [
            "fk_pev_establishment"
          ]
        },
        {
          "name": "address_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "address_id UUID NOT NULL UNIQUE",
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
          "generated": "PEV",
          "nullable": false,
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "name VARCHAR(100) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "description TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "monthly_price",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "monthly_price DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "volume_limit_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "volume_limit_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_limit",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "collection_limit INTEGER NOT NULL",
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
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
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
          "definition": "status subscription_status_t NOT NULL DEFAULT 'PENDING'",
          "description": "",
          "fk": []
        },
        {
          "name": "activated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "activated_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "inactivated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "inactivated_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
        "UNIQUE (establishment_id) WHERE status = 'ACTIVE'"
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "subscription_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "subscription_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_subscription_owner"
          ]
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_subscription_owner"
          ]
        },
        {
          "name": "cycle_number",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "cycle_number INTEGER NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "starts_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "starts_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "ends_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "ends_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "anchor_day",
          "type": "SMALLINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "anchor_day SMALLINT NOT NULL",
          "description": "Dia original do calendário mensal: 31 pode ajustar para fevereiro sem virar 28 nos meses seguintes.",
          "fk": []
        },
        {
          "name": "anchor_local_time",
          "type": "TIME",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "anchor_local_time TIME NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "anchor_timezone",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "anchor_timezone VARCHAR(100) NOT NULL",
          "description": "Fuso usado no calendário mensal; TIMESTAMPTZ preserva o instante, não o nome do fuso.",
          "fk": []
        },
        {
          "name": "plan_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "plan_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_plan"
          ]
        },
        {
          "name": "plan_name",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "plan_name VARCHAR(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "plan_description",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "plan_description TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "monthly_price",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "monthly_price DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "volume_limit_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "volume_limit_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_limit",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "collection_limit INTEGER NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
        "CONSTRAINT ex_cycle_no_overlap EXCLUDE USING gist (establishment_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)"
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_order_subscription_owner",
            "fk_order_target_cycle",
            "fk_order_previous_cycle"
          ]
        },
        {
          "name": "subscription_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "subscription_id UUID NOT NULL",
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
          "definition": "purpose billing_purpose_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "benefit_key",
          "type": "VARCHAR(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "benefit_key VARCHAR(150) NOT NULL",
          "description": "Identidade estável do benefício; reutilizar nas reemissões da cobrança equivalente.",
          "fk": []
        },
        {
          "name": "target_cycle_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "target_cycle_id UUID",
          "description": "",
          "fk": [
            "fk_order_target_cycle"
          ]
        },
        {
          "name": "previous_cycle_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "previous_cycle_id UUID",
          "description": "",
          "fk": [
            "fk_order_previous_cycle"
          ]
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
        "UNIQUE (subscription_id) WHERE purpose = 'INITIAL'",
        "UNIQUE (previous_cycle_id) WHERE purpose = 'RENEWAL'"
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "billing_order_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "billing_order_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_charge_order_owner",
            "fk_charge_order_target"
          ]
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
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
          "definition": "purpose billing_purpose_t NOT NULL",
          "description": "",
          "fk": [
            "fk_charge_order_owner"
          ]
        },
        {
          "name": "target_cycle_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "target_cycle_id UUID",
          "description": "",
          "fk": [
            "fk_charge_order_target",
            "fk_charge_cycle_owner"
          ]
        },
        {
          "name": "provider",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "provider VARCHAR(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "provider_charge_id",
          "type": "VARCHAR(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "provider_charge_id VARCHAR(255)",
          "description": "",
          "fk": []
        },
        {
          "name": "idempotency_key",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "idempotency_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()",
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
          "definition": "status charge_status_t NOT NULL DEFAULT 'OPEN'",
          "description": "",
          "fk": []
        },
        {
          "name": "plan_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "plan_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_charge_plan"
          ]
        },
        {
          "name": "plan_name",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "plan_name VARCHAR(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "plan_description",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "plan_description TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "quoted_monthly_price",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "quoted_monthly_price DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "quoted_volume_limit_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "quoted_volume_limit_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "quoted_collection_limit",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "quoted_collection_limit INTEGER NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "from_plan_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "from_plan_id UUID",
          "description": "",
          "fk": [
            "fk_charge_from_plan"
          ]
        },
        {
          "name": "from_monthly_price",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "from_monthly_price DECIMAL(10,2)",
          "description": "",
          "fk": []
        },
        {
          "name": "amount",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "amount DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "currency",
          "type": "CHAR(3)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "currency CHAR(3) NOT NULL DEFAULT 'BRL'",
          "description": "",
          "fk": []
        },
        {
          "name": "expires_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "expires_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "closed_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "closed_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
        "UNIQUE (establishment_id) WHERE purpose IN ('INITIAL','RENEWAL') AND status IN ('OPEN','CANCELLATION_PENDING')",
        "UNIQUE (target_cycle_id) WHERE purpose = 'UPGRADE' AND status IN ('OPEN','CANCELLATION_PENDING')"
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "billing_charge_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "billing_charge_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_order",
            "fk_payment_charge_provider"
          ]
        },
        {
          "name": "billing_order_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "billing_order_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_order"
          ]
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_order"
          ]
        },
        {
          "name": "provider",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "provider VARCHAR(100) NOT NULL",
          "description": "",
          "fk": [
            "fk_payment_charge_provider"
          ]
        },
        {
          "name": "provider_payment_id",
          "type": "VARCHAR(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "provider_payment_id VARCHAR(255) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "amount",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "amount DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "currency",
          "type": "CHAR(3)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "currency CHAR(3) NOT NULL DEFAULT 'BRL'",
          "description": "",
          "fk": []
        },
        {
          "name": "paid_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "paid_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "verified_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "verified_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "payment_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "payment_id UUID NOT NULL UNIQUE",
          "description": "",
          "fk": [
            "fk_application_payment_order"
          ]
        },
        {
          "name": "billing_order_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "billing_order_id UUID NOT NULL UNIQUE",
          "description": "",
          "fk": [
            "fk_application_payment_order",
            "fk_application_order"
          ]
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
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
          "definition": "purpose billing_purpose_t NOT NULL",
          "description": "",
          "fk": [
            "fk_application_order"
          ]
        },
        {
          "name": "cycle_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "cycle_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_application_cycle_owner"
          ]
        },
        {
          "name": "applied_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "applied_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
        "UNIQUE (cycle_id) WHERE purpose IN ('INITIAL','RENEWAL')"
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "cycle_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "cycle_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_change_application"
          ]
        },
        {
          "name": "payment_application_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "payment_application_id UUID NOT NULL UNIQUE",
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
          "generated": "UPGRADE",
          "nullable": false,
          "definition": "purpose billing_purpose_t GENERATED ALWAYS AS ('UPGRADE'::billing_purpose_t) STORED",
          "description": "",
          "fk": [
            "fk_cycle_change_application"
          ]
        },
        {
          "name": "from_plan_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "from_plan_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_change_from_plan"
          ]
        },
        {
          "name": "to_plan_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "to_plan_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_cycle_change_to_plan"
          ]
        },
        {
          "name": "from_monthly_price",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "from_monthly_price DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "to_monthly_price",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "to_monthly_price DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "from_volume_limit_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "from_volume_limit_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "to_volume_limit_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "to_volume_limit_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "from_collection_limit",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "from_collection_limit INTEGER NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "to_collection_limit",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "to_collection_limit INTEGER NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "applied_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "applied_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "payment_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "payment_id UUID NOT NULL UNIQUE",
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
          "definition": "reason refund_reason_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "amount",
          "type": "DECIMAL(10,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "amount DECIMAL(10,2) NOT NULL",
          "description": "",
          "fk": [
            "fk_refund_payment"
          ]
        },
        {
          "name": "provider",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "provider VARCHAR(100) NOT NULL",
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
          "definition": "status refund_status_t NOT NULL DEFAULT 'REQUESTED'",
          "description": "",
          "fk": []
        },
        {
          "name": "idempotency_key",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "idempotency_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "provider_refund_id",
          "type": "VARCHAR(255)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "provider_refund_id VARCHAR(255)",
          "description": "",
          "fk": []
        },
        {
          "name": "requested_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "completed_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "completed_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "next_attempt_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "next_attempt_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "last_error",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "last_error TEXT",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "estimated_volume_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "estimated_volume_liters DECIMAL(8,2) NOT NULL",
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
          "definition": "status request_status_t NOT NULL DEFAULT 'PENDING'",
          "description": "",
          "fk": []
        },
        {
          "name": "observation",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "observation TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "request_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "request_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_request_cycle_owner"
          ]
        },
        {
          "name": "subscription_cycle_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "subscription_cycle_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_request_cycle_owner"
          ]
        },
        {
          "name": "approved_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "approved_by UUID",
          "description": "",
          "fk": [
            "fk_request_admin"
          ]
        },
        {
          "name": "approved_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "approved_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "ADMIN",
          "nullable": false,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_request_admin"
          ]
        },
        {
          "name": "scheduled_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "scheduled_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "arrived_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "arrived_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "arrival_recorded_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "arrival_recorded_at TIMESTAMPTZ",
          "description": "Momento registrado pelo backend; informar depois não penaliza retroativamente um cancelamento gratuito.",
          "fk": []
        },
        {
          "name": "arrival_driver_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "arrival_driver_id UUID",
          "description": "",
          "fk": [
            "fk_request_arrival_driver"
          ]
        },
        {
          "name": "service_accepted_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "service_accepted_at TIMESTAMPTZ",
          "description": "Aceite do estabelecimento para início do atendimento; após chegada atrasada, encerra a opção de cancelar gratuitamente.",
          "fk": []
        },
        {
          "name": "service_acceptance_recorded_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "service_acceptance_recorded_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "service_accepted_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "service_accepted_by UUID",
          "description": "",
          "fk": [
            "fk_request_service_accepted_by"
          ]
        },
        {
          "name": "cancelled_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "cancelled_at TIMESTAMPTZ",
          "description": "Instante efetivo da decisão de cancelamento, validado pelo backend; não é horário livre informado pelo cliente.",
          "fk": []
        },
        {
          "name": "cancellation_recorded_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "cancellation_recorded_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "cancelled_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "cancelled_by UUID",
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
          "definition": "cancellation_policy cancellation_policy_t",
          "description": "",
          "fk": []
        },
        {
          "name": "cancellation_reason",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "cancellation_reason TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "forfeited_volume_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "forfeited_volume_liters DECIMAL(8,2) NOT NULL DEFAULT 0",
          "description": "Franquia perdida por cancelamento tardio; não representa óleo recolhido, pontos ou volume ambiental.",
          "fk": []
        },
        {
          "name": "forfeited_collection_slots",
          "type": "SMALLINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "forfeited_collection_slots SMALLINT NOT NULL DEFAULT 0",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_request_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "collection_request_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_schedule_request"
          ]
        },
        {
          "name": "previous_scheduled_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "previous_scheduled_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "new_scheduled_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "new_scheduled_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "agreed_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "agreed_at TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "changed_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "changed_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "changed_by UUID NOT NULL",
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
          "generated": "ADMIN",
          "nullable": false,
          "definition": "admin_type user_type_t GENERATED ALWAYS AS ('ADMIN'::user_type_t) STORED",
          "description": "",
          "fk": [
            "fk_schedule_admin"
          ]
        },
        {
          "name": "reason",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "reason TEXT NOT NULL",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "collected_volume_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "collected_volume_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "presented_volume_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "presented_volume_liters DECIMAL(8,2) NOT NULL",
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
          "definition": "oil_condition oil_condition_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "has_compromising_occurrence",
          "type": "BOOLEAN",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "has_compromising_occurrence BOOLEAN NOT NULL",
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
          "definition": "result collection_result_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "points_earned",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "points_earned BIGINT NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "observation",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "observation TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_date",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "collection_date TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "collection_request_id",
          "type": "UUID",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "collection_request_id UUID NOT NULL UNIQUE",
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
          "generated": "APPROVED",
          "nullable": false,
          "definition": "request_status request_status_t GENERATED ALWAYS AS ('APPROVED'::request_status_t) STORED",
          "description": "",
          "fk": [
            "fk_collection_request_owner"
          ]
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_collection_request_owner"
          ]
        },
        {
          "name": "processing_order",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "processing_order BIGINT NOT NULL",
          "description": "Ordem fixa por estabelecimento para reconstruir pontos e piso zero, independente da data física da visita.",
          "fk": []
        },
        {
          "name": "driver_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "driver_id UUID NOT NULL",
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
          "definition": "record_status record_status_t NOT NULL DEFAULT 'RECORDED'",
          "description": "",
          "fk": []
        },
        {
          "name": "revision",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "revision INTEGER NOT NULL DEFAULT 1",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "corrected_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "corrected_by UUID",
          "description": "",
          "fk": [
            "fk_collection_correction_admin"
          ]
        },
        {
          "name": "correction_reason",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "correction_reason TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "ADMIN",
          "nullable": false,
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "code",
          "type": "VARCHAR(50)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "code VARCHAR(50) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "VARCHAR(150)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "name VARCHAR(150) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "description TEXT",
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
          "definition": "status active_status_t NOT NULL DEFAULT 'ACTIVE'",
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "collection_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_failure_collection"
          ]
        },
        {
          "name": "failure_reason_id",
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "failure_reason_id UUID NOT NULL",
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "oil_volume_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "oil_volume_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "points_earned",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "points_earned BIGINT NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "delivery_date",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "delivery_date TIMESTAMPTZ NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "citizen_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "citizen_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_delivery_citizen"
          ]
        },
        {
          "name": "pev_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "pev_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_delivery_pev"
          ]
        },
        {
          "name": "validated_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "validated_by UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_delivery_validator"
          ]
        },
        {
          "name": "record_status",
          "type": "record_status_t",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "record_status record_status_t NOT NULL DEFAULT 'RECORDED'",
          "description": "",
          "fk": []
        },
        {
          "name": "revision",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "revision INTEGER NOT NULL DEFAULT 1",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "corrected_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "corrected_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "corrected_by UUID",
          "description": "",
          "fk": [
            "fk_delivery_correction_admin"
          ]
        },
        {
          "name": "correction_reason",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "correction_reason TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "ADMIN",
          "nullable": false,
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
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "user_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "user_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_point_calculation_user",
            "fk_point_calculation_collection",
            "fk_point_calculation_delivery"
          ]
        },
        {
          "name": "collection_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "collection_id UUID",
          "description": "",
          "fk": [
            "fk_point_calculation_collection"
          ]
        },
        {
          "name": "delivery_pev_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "delivery_pev_id UUID",
          "description": "",
          "fk": [
            "fk_point_calculation_delivery"
          ]
        },
        {
          "name": "revision",
          "type": "INTEGER",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "revision INTEGER NOT NULL",
          "description": "Revisão do cálculo, inclusive por correção de evento anterior; não precisa coincidir com a revisão da coleta.",
          "fk": []
        },
        {
          "name": "is_current",
          "type": "BOOLEAN",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "is_current BOOLEAN NOT NULL DEFAULT TRUE",
          "description": "",
          "fk": []
        },
        {
          "name": "points_total",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "points_total BIGINT NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "balance_before",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "balance_before BIGINT NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "balance_after",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "balance_after BIGINT NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "successful_collections_count",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "successful_collections_count BIGINT",
          "description": "",
          "fk": []
        },
        {
          "name": "calculated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "calculated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "recalculated_by",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "recalculated_by UUID",
          "description": "",
          "fk": [
            "fk_point_calculation_admin"
          ]
        },
        {
          "name": "recalculation_reason",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "recalculation_reason TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "admin_type",
          "type": "user_type_t",
          "pk": false,
          "unique": false,
          "generated": "ADMIN",
          "nullable": false,
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
        "UNIQUE (collection_id) WHERE is_current AND collection_id IS NOT NULL",
        "UNIQUE (delivery_pev_id) WHERE is_current AND delivery_pev_id IS NOT NULL"
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "point_calculation_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "point_calculation_id UUID NOT NULL",
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
          "definition": "component point_component_t NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "points",
          "type": "BIGINT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "points BIGINT NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
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
      "special": [],
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
      "description": "Metas e nomes definitivos pendentes; não inserir níveis fictícios.",
      "columns": [
        {
          "name": "id",
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "name",
          "type": "VARCHAR(100)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "name VARCHAR(100) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "description",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "description TEXT",
          "description": "",
          "fk": []
        },
        {
          "name": "required_liters",
          "type": "DECIMAL(8,2)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "required_liters DECIMAL(8,2) NOT NULL",
          "description": "",
          "fk": []
        },
        {
          "name": "badge_image_url",
          "type": "VARCHAR(500)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "badge_image_url VARCHAR(500)",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        }
      ],
      "pk": [
        "id"
      ],
      "uniques": [],
      "fks": [],
      "special": [],
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
          "type": "UUID",
          "pk": true,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
          "description": "",
          "fk": []
        },
        {
          "name": "certificate_code",
          "type": "VARCHAR(64)",
          "pk": false,
          "unique": true,
          "generated": null,
          "nullable": false,
          "definition": "certificate_code VARCHAR(64) NOT NULL UNIQUE",
          "description": "",
          "fk": []
        },
        {
          "name": "pdf_url",
          "type": "VARCHAR(500)",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "pdf_url VARCHAR(500)",
          "description": "",
          "fk": []
        },
        {
          "name": "issued_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "created_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "updated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
          "description": "",
          "fk": []
        },
        {
          "name": "certificate_level_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "certificate_level_id UUID NOT NULL",
          "description": "",
          "fk": [
            "fk_certificate_level"
          ]
        },
        {
          "name": "establishment_id",
          "type": "UUID",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": false,
          "definition": "establishment_id UUID NOT NULL",
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
          "definition": "status certificate_status_t NOT NULL DEFAULT 'ACTIVE'",
          "description": "",
          "fk": []
        },
        {
          "name": "revoked_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "revoked_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "reactivated_at",
          "type": "TIMESTAMPTZ",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "reactivated_at TIMESTAMPTZ",
          "description": "",
          "fk": []
        },
        {
          "name": "status_reason",
          "type": "TEXT",
          "pk": false,
          "unique": false,
          "generated": null,
          "nullable": true,
          "definition": "status_reason TEXT",
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
      "special": [],
      "main": [
        "id",
        "establishment_id",
        "certificate_level_id",
        "certificate_code",
        "status"
      ]
    }
  },
  "domains": [
    {
      "id": "cadastros",
      "title": "Cadastros e identidade",
      "subtitle": "Usuários, perfis, QR e endereço",
      "tables": [
        "users",
        "citizens",
        "establishment",
        "user_qr_code",
        "telephone",
        "addresses",
        "establishment_type"
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
    }
  ],
  "excluded": [
    {
      "name": "payment_refund_attempt",
      "reason": "Tentativas técnicas de execução do reembolso."
    },
    {
      "name": "payment_provider_event",
      "reason": "Recepção, deduplicação e reprocessamento de eventos do provedor."
    },
    {
      "name": "users_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "establishment_type_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "addresses_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "telephone_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "user_qr_code_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "citizens_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "establishment_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "driver_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "pev_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "subscription_plan_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "establishment_subscription_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "subscription_cycle_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "billing_order_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "billing_charge_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "payment_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "payment_application_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "subscription_cycle_change_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "payment_refund_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "payment_refund_attempt_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "payment_provider_event_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "collection_request_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "collection_schedule_history_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "collection_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "collection_failure_reason_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "collection_failure_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "delivery_pev_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "point_calculation_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "point_transaction_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "certificate_level_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    },
    {
      "name": "certificate_log",
      "reason": "Retratos tipados de auditoria (BEFORE/AFTER)."
    }
  ],
  "source": {
    "file": "01_structure.sql",
    "sha256": "58f95a2a9995b1602a6374e0aac1736091844e87fe8a30fd6fc97957733fc90e",
    "revision": "10/09/2026",
    "analyzed": "11/09/2026",
    "checks_sha256": "0f8e8e249be888d6b47efb5146bd4334bc7a264329ff567e9c2c306adeede344"
  },
  "partial": [
    {
      "name": "uq_subscription_active",
      "table": "establishment_subscription",
      "columns": "establishment_id",
      "predicate": "status = 'ACTIVE'"
    },
    {
      "name": "uq_order_initial_subscription",
      "table": "billing_order",
      "columns": "subscription_id",
      "predicate": "purpose = 'INITIAL'"
    },
    {
      "name": "uq_order_renewal_previous_cycle",
      "table": "billing_order",
      "columns": "previous_cycle_id",
      "predicate": "purpose = 'RENEWAL'"
    },
    {
      "name": "uq_charge_open_period",
      "table": "billing_charge",
      "columns": "establishment_id",
      "predicate": "purpose IN ('INITIAL','RENEWAL') AND status IN ('OPEN','CANCELLATION_PENDING')"
    },
    {
      "name": "uq_charge_open_upgrade",
      "table": "billing_charge",
      "columns": "target_cycle_id",
      "predicate": "purpose = 'UPGRADE' AND status IN ('OPEN','CANCELLATION_PENDING')"
    },
    {
      "name": "uq_application_initial_cycle",
      "table": "payment_application",
      "columns": "cycle_id",
      "predicate": "purpose IN ('INITIAL','RENEWAL')"
    },
    {
      "name": "uq_point_collection_current",
      "table": "point_calculation",
      "columns": "collection_id",
      "predicate": "is_current AND collection_id IS NOT NULL"
    },
    {
      "name": "uq_point_delivery_current",
      "table": "point_calculation",
      "columns": "delivery_pev_id",
      "predicate": "is_current AND delivery_pev_id IS NOT NULL"
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
                "request_at"
              ],
              "why": "Registrar PENDING e a estimativa positiva no ciclo de origem."
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
                "revision"
              ],
              "why": "Registrar volume aceito, autor, data física, RECORDED e revisão inicial."
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
    }
  ]
};

// Utilitários, cores e estado da modelagem.
const $=id=>document.getElementById(id);
const T=MODEL.tables, F=MODEL.fks, NS='http://www.w3.org/2000/svg';
const colors= {
  cadastros:'#267092',planos:'#8062a9',financeiro:'#a36322',b2b:'#247765',b2c:'#287a9b',pontos:'#a35177'
};
const central=new Set(['users','establishment','subscription_cycle','billing_order','collection','point_calculation']);
let active='overview', selected='establishment', detailTab='fields', zoom=1, svg;
function esc(x) {
  return String(x).replace(/[&<>"']/g,c=>( {
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }
  [c]));
}
function el(tag,attrs= {
},text) {
  const n=document.createElementNS(NS,tag);
  for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);
  if(text!==undefined)n.textContent=text;
  return n;
}
function domain(id) {
  return MODEL.domains.find(d=>d.id===id);
}
function sceneFor(name) {
  return MODEL.scenes.find(s=>s.domain===T[name].domain&&s.nodes.includes(name))||MODEL.scenes.find(s=>s.nodes.includes(name));
}
function nav() {
  MODEL.scenes.forEach(s=> {
    const b=document.createElement('button');
    b.textContent=s.title;
    b.dataset.view=s.id;
    b.type='button';
    b.onclick=()=>show(s.id);
    $('views').append(b);
  });
}
function nodeSelect(name,jump=false) {
  selected=name;
  detailTab='fields';
  if(jump) {
    const s=sceneFor(name);
    show(s.id);
  }
  else {
    paintSelection();
    inspect();
  }
  $('selection').textContent=name+' · '+T[name].columns.length+' campos · '+T[name].fks.length+' FKs de saída.';
}
function link(name) {
  return '<button type="button" data-table="'+esc(name)+'">'+esc(name)+'</button>';
}
function bindLinks(root) {
  root.querySelectorAll('[data-table]').forEach(b=>b.onclick=()=> {
    if(uiMode==='journeys')openFlowTable(b.dataset.table);
    else nodeSelect(b.dataset.table,true);
  });
}
// Painel de campos, relacionamentos e regras da tabela selecionada.
function inspect() {
  const t=T[selected], d=domain(t.domain);
  let html='<div class="domain"><span class="domain-chip" style="background:'+colors[t.domain]+'"></span>'+esc(d.title)+'</div><h2>'+esc(t.name)+'</h2><p class="desc">'+esc(t.description)+'</p><div class="tabs" aria-label="Detalhes">';
  for(const[id,label]of[['fields','Campos'],['relations','Relacionamentos'],['rules','Regras']])html+='<button type="button" data-detail="'+id+'" aria-pressed="'+(detailTab===id)+'">'+label+'</button>';
  html+='</div>';
  if(detailTab==='fields') {
    html+='<p class="empty">Todos os '+t.columns.length+' campos · G = valor gerado</p>';
    t.columns.forEach(c=> {
      html+='<div class="field"><div class="field-top"><span class="field-name">'+esc(c.name)+'</span><span class="badges">'+(c.pk?'<span class="pk">PK</span> ':'')+(c.fk.length?'<span class="fk">FK</span> ':'')+(c.unique?'UQ ':'')+(c.generated?'G':'')+'</span></div><div class="field-type">'+esc(c.type)+' · <span class="nullable">'+(c.nullable?'aceita NULL':'não nulo')+'</span></div>'+(c.generated?'<div class="field-desc">Gerado: '+esc(c.generated)+'</div>':'')+(c.description?'<div class="field-desc">'+esc(c.description)+'</div>':'')+'</div>';
    });
  }
  if(detailTab==='relations') {
    const outgoing=F.filter(f=>f.child===selected), incoming=F.filter(f=>f.parent===selected);
    html+='<h3>Referências desta tabela ('+outgoing.length+')</h3>'+outgoing.map(f=>relationHTML(f)).join('');
    if(!outgoing.length)html+='<p class="empty">Nenhuma FK de saída.</p>';
    html+='<h3>Tabelas que a referenciam ('+incoming.length+')</h3>'+incoming.map(f=>relationHTML(f)).join('');
    if(!incoming.length)html+='<p class="empty">Nenhuma FK de entrada no escopo visual.</p>';
  }
  if(detailTab==='rules') {
    html+='<div class="rule"><b>Chave primária</b><br><code>('+esc(t.pk.join(', '))+')</code></div>';
    t.uniques.forEach(u=>html+='<div class="rule"><b>Unicidade</b><br><code>('+esc(u.columns.join(', '))+')</code><div class="constraint">'+esc(u.name)+'</div></div>');
    t.special.forEach(s=>html+='<div class="rule"><b>Restrição estrutural</b><br><code>'+esc(s)+'</code></div>');
    if(t.name==='establishment_subscription')html+='<p class="desc">Pode haver várias assinaturas ao longo do tempo. O índice parcial permite no máximo uma ACTIVE por estabelecimento.</p>';
    if(t.name==='subscription_cycle')html+='<p class="desc">EXCLUDE impede sobreposição de períodos por estabelecimento. [início, fim) admite que um ciclo comece exatamente quando outro termina.</p>';
    if(t.name==='point_calculation')html+='<p class="desc">Várias revisões são possíveis. Os índices parciais limitam a uma revisão is_current por coleta ou entrega.</p>';
    html+='<p class="empty">CHECKs do script 02 e rotinas não fazem parte desta extração.</p>';
  }
  $('inspector').innerHTML=html;
  decorateInspector();
  $('inspector').querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=> {
    detailTab=b.dataset.detail;
    inspect();
  });
  bindLinks($('inspector'));
}
function relationHTML(f) {
  return '<div class="relation"><div>'+link(f.child)+' → '+link(f.parent)+'</div><div class="mapping">('+esc(f.columns.join(', '))+')<br>→ ('+esc(f.references.join(', '))+')</div><div class="cardinality">Por linha de '+esc(f.child)+': <b>'+esc(f.parentCard)+'</b> '+esc(f.parent)+'<br>Por linha de '+esc(f.parent)+': <b>'+esc(f.childCard)+'</b> '+esc(f.child)+'</div><div class="constraint">'+esc(f.name)+'<br>'+esc(f.actions)+'</div></div>';
}
function showRelations(group) {
  $('inspector').innerHTML='<div class="domain">Relacionamento estrutural</div><h2>'+group.length+' FK'+(group.length>1?'s':'')+'</h2>'+group.map(relationHTML).join('');
  bindLinks($('inspector'));
  $('selection').textContent=group.map(f=>f.name).join(' · ');
  svg.querySelectorAll('.edge').forEach(g=>g.classList.toggle('edge-active',g.dataset.key===group[0].child+'|'+group[0].parent));
}
function paintSelection() {
  if(!svg)return;
  svg.querySelectorAll('[data-node]').forEach(n=>n.classList.toggle('node-selected',n.dataset.node===selected));
  svg.querySelectorAll('.edge').forEach(g=> {
    const touch=g.dataset.child===selected||g.dataset.parent===selected;
    g.classList.toggle('edge-active',touch);
    g.classList.remove('edge-dim');
  });
}
// Renderização SVG dos diagramas e suas conexões.
function createSVG(height,label) {
  svg=el('svg', {
    viewBox:'0 0 940 '+height,role:'img','aria-label':label
  });
  svg.append(el('title', {
  },label));
  const defs=el('defs');
  const marker=el('marker', {
    id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'
  });
  marker.append(el('path', {
    d:'M 0 0 L 10 5 L 0 10 z',fill:'#7d919d'
  }));
  defs.append(marker);
  svg.append(defs);
  $('stage').replaceChildren(svg);
}
function drawNode(name,p,scene) {
  const t=T[name],g=el('g', {
    'data-node':name,class:'node-button',role:'button',tabindex:'0','aria-label':name+', consultar campos e relacionamentos'
  });
  g.onclick=()=>nodeSelect(name);
  g.onkeydown=e=> {
    if(e.key==='Enter'||e.key===' ') {
      e.preventDefault();
      nodeSelect(name);
    }
  };
  const context=t.domain!==scene.domain;
  g.append(el('rect', {
    x:p.x,y:p.y,width:p.w,height:p.h,rx:7,class:'node-box'+(context?' context':'')
  }));
  g.append(el('rect', {
    x:p.x,y:p.y,width:5,height:p.h,rx:2,fill:colors[t.domain]
  }));
  g.append(el('text', {
    x:p.x+16,y:p.y+26,class:'node-title'
  },name));
  if(context)g.append(el('text', {
    x:p.x+16,y:p.y+43,class:'node-context'
  },'CONTEXTO · '+domain(t.domain).title));
  else if(central.has(name))g.append(el('text', {
    x:p.x+16,y:p.y+43,class:'node-context'
  },'ENTIDADE CENTRAL'));
  g.append(el('line', {
    x1:p.x+1,y1:p.y+52,x2:p.x+p.w-1,y2:p.y+52,class:'node-divider'
  }));
  t.main.forEach((n,i)=> {
    const c=t.columns.find(c=>c.name===n),y=p.y+74+i*23;
    let badge=(c.pk?'PK':'')+(c.pk&&c.fk.length?'/':'')+(c.fk.length?'FK':'');
    g.append(el('text', {
      x:p.x+14,y,class:'node-badge',fill:c.pk?'#87600c':'#225fc2'
    },badge));
    g.append(el('text', {
      x:p.x+59,y,class:'node-field'
    },n));
  });
  const extra=t.columns.length-t.main.length;
  g.append(el('text', {
    x:p.x+16,y:p.y+p.h-13,class:'node-footer'
  },extra?'+'+extra+' campos · ficha completa ao selecionar':'Todos os campos principais'));
  svg.append(g);
}
function pathPoints(a,b,idx,total,sy,ty) {
  const same=a.col===b.col;
  let sx,tx,mx;
  const ratio=(idx+1)/(total+1);
  if(same) {
    sx=a.col===0?a.x:a.x+a.w;
    tx=b.col===0?b.x:b.x+b.w;
    mx=a.col===0?10+ratio*34:930-ratio*34;
  }
  else {
    sx=a.col===0?a.x+a.w:a.x;
    tx=b.col===0?b.x+b.w:b.x;
    mx=415+ratio*110;
  }
  return {
    d:`M ${sx} ${sy} H ${mx} V ${ty} H ${tx}`,sx,sy,tx,ty,mx,same
  };
}
function drawEdges(edges,positions,overview=false) {
  const grouped=new Map();
  edges.forEach(f=> {
    let key=f.child+'|'+f.parent;
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push(f);
  });
  const ports= {
  };
  const side=(a,b)=>a.col===b.col?(a.col===0?'L':'R'):(a.col===0?'R':'L');
  for(const[key,group]of grouped) {
    const f=group[0],a=positions[f.child],b=positions[f.parent];
    for(const[n,p,q]of[[f.child,a,b],[f.parent,b,a]]) {
      const k=n+side(p,q);
      if(!ports[k])ports[k]=[];
      ports[k].push(key);
    }
  }
  const port=(n,a,b,key)=> {
    const keys=ports[n+side(a,b)];
    return a.y+62+(a.h-93)*(keys.indexOf(key)+1)/(keys.length+1);
  };
  let idx=0;
  for(const[key,group]of grouped) {
    const f=group[0],a=positions[f.child],b=positions[f.parent];
    if(!a||!b)continue;
    const p=pathPoints(a,b,idx,grouped.size,port(f.child,a,b,key),port(f.parent,b,a,key)),g=el('g', {
      class:'edge','data-key':key,'data-child':f.child,'data-parent':f.parent
    });
    g.append(el('path', {
      d:p.d,class:'edge-path','marker-end':'url(#arrow)'
    }));
    if(!overview) {
      const sameParent=new Set(group.map(x=>x.parentCard)).size===1,sameChild=new Set(group.map(x=>x.childCard)).size===1;
      const sourceRight=p.sx>a.x,targetRight=p.tx>b.x;
      g.append(el('text', {
        x:p.sx+(sourceRight?7:-7),y:p.sy-7,'text-anchor':sourceRight?'start':'end',class:'edge-label'
      },sameChild?f.childCard:'ver FKs'));
      g.append(el('text', {
        x:p.tx+(targetRight?7:-7),y:p.ty-7,'text-anchor':targetRight?'start':'end',class:'edge-label'
      },sameParent?f.parentCard:'ver FKs'));
      if(group.length>1)g.append(el('text', {
        x:p.mx+5,y:(p.sy+p.ty)/2-7,class:'edge-label'
      },'×'+group.length));
    }
    else {
      g.append(el('text', {
        x:p.mx+6,y:(p.sy+p.ty)/2-8,class:'edge-label'
      },String(group.length)));
    }
    g.append(el('title', {
    },overview?f.child+' → '+f.parent:group.map(x=>x.name).join('\n')));
    const hit=el('path', {
      d:p.d,class:'edge-hit'
    });
    hit.onclick=()=> {
      if(!overview)showRelations(group);
    };
    g.append(hit);
    svg.append(g);
    idx++;
  }
}
function diagram(scene) {
  const pos= {
  };
  let y=40;
  for(let i=0;
  i<scene.nodes.length;
  i+=2) {
    let h=0;
    for(let j=0;
    j<2&&i+j<scene.nodes.length;
    j++) {
      const n=scene.nodes[i+j],nh=92+T[n].main.length*23;
      pos[n]= {
        x:j===0?55:545,y,w:340,h:nh,col:j
      };
      h=Math.max(h,nh);
    }
    y+=h+86;
  }
  createSVG(y-40,'Diagrama '+scene.title);
  drawEdges(scene.edges.map(n=>F.find(f=>f.name===n)),pos);
  scene.nodes.forEach(n=>drawNode(n,pos[n],scene));
  $('diagram-title').textContent=scene.title;
  $('diagram-caption').textContent='Campos principais · selecione uma tabela ou linha. FKs auxiliares e externas estão na ficha completa.';
}
function overview() {
  const pos= {
  };
  let y=45;
  MODEL.domains.forEach((d,i)=> {
    const row=Math.floor(i/2),col=i%2;
    pos[d.id]= {
      x:col?545:55,y:45+row*350,w:340,h:270,col
    };
  });
  createSVG(1070,'Visão geral dos seis domínios do OLIUS');
  const links=F.filter(f=>T[f.child].domain!==T[f.parent].domain).map(f=>( {
    ...f,child:T[f.child].domain,parent:T[f.parent].domain
  }));
  drawEdges(links,pos,true);
  MODEL.domains.forEach(d=> {
    const p=pos[d.id],g=el('g');
    g.append(el('rect', {
      x:p.x,y:p.y,width:p.w,height:p.h,rx:8,class:'node-box'
    }));
    g.append(el('rect', {
      x:p.x,y:p.y,width:5,height:p.h,fill:colors[d.id],rx:2
    }));
    g.append(el('text', {
      x:p.x+17,y:p.y+29,class:'domain-name'
    },d.title));
    g.append(el('text', {
      x:p.x+17,y:p.y+50,class:'domain-sub'
    },d.subtitle));
    g.append(el('line', {
      x1:p.x+1,y1:p.y+66,x2:p.x+p.w-1,y2:p.y+66,class:'node-divider'
    }));
    d.tables.forEach((name,i)=> {
      const row=el('g', {
        role:'button',tabindex:'0','aria-label':'Explorar '+name,style:'cursor:pointer'
      });
      row.append(el('text', {
        x:p.x+19,y:p.y+92+i*23,class:'overview-item'
      },name));
      row.onclick=()=>nodeSelect(name,true);
      row.onkeydown=e=> {
        if(e.key==='Enter'||e.key===' ') {
          e.preventDefault();
          nodeSelect(name,true);
        }
      };
      g.append(row);
    });
    svg.append(g);
  });
  $('diagram-title').textContent='28 tabelas · 6 domínios';
  $('diagram-caption').textContent='Cada seta liga domínios com FKs reais; o número conta essas FKs. Selecione uma tabela para abrir seu diagrama.';
}
function show(id) {
  setSection(id==='overview'?'overview':'model');
  active=id;
  zoom=1;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===id));
  if(id==='overview')overview();
  else {
    const scene=MODEL.scenes.find(s=>s.id===id);
    if(!scene.nodes.includes(selected))selected=scene.nodes.find(n=>T[n].domain===scene.domain);
    diagram(scene);
  }
  setZoom();
  paintSelection();
  inspect();
}
function setZoom() {
  svg.style.width=(zoom*100)+'%';
  $('zoom-label').textContent=Math.round(zoom*100)+'%';
  $('zoom-out').disabled=zoom<=.8;
  $('zoom-in').disabled=zoom>=2;
}
$('zoom-in').onclick=()=> {
  zoom=Math.min(2,zoom+.2);
  setZoom();
};
$('zoom-out').onclick=()=> {
  zoom=Math.max(.8,zoom-.2);
  setZoom();
};
$('zoom-reset').onclick=()=> {
  zoom=1;
  setZoom();
};
// Navegação e detalhes das jornadas de negócio.
const JOURNEYS=MODEL.journeys;
let uiMode='overview', currentJourney=JOURNEYS[0].id, currentStep=JOURNEYS[0].steps[0].id;
const journeyById=id=>JOURNEYS.find(j=>j.id===id);
const flowStep=()=>journeyById(currentJourney).steps.find(s=>s.id===currentStep);
function setSection(mode) {
  uiMode=mode;
  document.querySelectorAll('[data-section]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.section===mode));
  $('views').hidden=mode!=='model';
  $('journey-picker').hidden=mode!=='journeys';
  $('journey-intro').hidden=mode!=='journeys';
  document.querySelector('.tools').hidden=mode==='journeys';
  document.querySelector('.legend').hidden=mode==='journeys';
  $('stage').classList.toggle('flow-mode',mode==='journeys');
}
function initJourneys() {
  document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=> {
    if(b.dataset.section==='journeys')showJourney(currentJourney,currentStep);
    else show(b.dataset.section==='overview'?'overview':(active==='overview'?'identidade':active));
  });
  const groups=[['B2B',['contratacao','coleta']],['B2C',['entrega']],['Compartilhado',['reembolso']]];
  $('journey-picker').innerHTML=groups.map(([label,ids])=>'<div class="journey-group"><span class="journey-group-label">'+esc(label)+'</span>'+ids.map(id=>'<button type="button" data-journey="'+id+'">'+esc(journeyById(id).title)+'</button>').join('')+'</div>').join('');
  $('journey-picker').querySelectorAll('[data-journey]').forEach(b=>b.onclick=()=>showJourney(b.dataset.journey));
}
function opClass(action) {
  return 'action-'+action.toLowerCase();
}
function flowTableLink(table) {
  return '<button type="button" class="table-link flow-table" data-flow-table="'+esc(table)+'">'+esc(table)+'</button>';
}
function branchHTML(b) {
  let action='';
  if(b.journey)action='<button type="button" class="tool" data-go-journey="'+b.journey+'">Abrir: '+esc(journeyById(b.journey).title)+'</button>';
  if(b.target)action='<button type="button" class="tool" data-go-step="'+b.target+'">Ver etapa relacionada</button>';
  return '<div class="flow-branch"><strong>'+esc(b.condition)+'</strong>'+esc(b.outcome)+action+'</div>';
}
function showJourney(id,stepId) {
  const j=journeyById(id);
  currentJourney=id;
  currentStep=stepId||j.steps[0].id;
  setSection('journeys');
  svg=null;
  $('journey-picker').querySelectorAll('[data-journey]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.journey===id));
  $('diagram-title').textContent=j.title;
  $('diagram-caption').textContent='Acompanhe as ações e suas tabelas. Selecione uma etapa para ver campos, regras e dependências.';
  $('journey-intro').innerHTML='<p><span class="tag">'+esc(j.profile)+'</span> '+esc(j.goal)+'</p><details><summary>Condições, resultado e fontes</summary><p><b>Antes de começar:</b> '+esc(j.prerequisite)+'</p><p><b>Resultado:</b> '+esc(j.outcome)+'</p><p><b>Recorte:</b> '+esc(j.scope)+'</p><p><b>Fontes:</b> '+esc(j.references)+'</p></details><p class="flow-global-note">Comportamento previsto pelas regras e pelos scripts; não comprova que as rotinas já foram implementadas. As setas abaixo indicam sequência de negócio, não FKs. As quatro jornadas são o recorte inicial.</p>';
  let html='<div class="flow-legend"><span class="action-consultar">Consultar · ler dados</span><span class="action-criar">Criar · novo registro</span><span class="action-atualizar">Atualizar · alterar registro existente</span></div><ol class="flow-list">';
  j.steps.forEach((s,i)=> {
    const actions=['Consultar','Criar','Atualizar'].filter(a=>s.operations.some(o=>o.action===a));
    html+='<li class="flow-item" data-flow-item="'+s.id+'"><article class="flow-card" style="--flow-color:'+colors[s.domain]+'"><button type="button" class="step-heading" data-step="'+s.id+'" aria-controls="inspector"><span class="step-number">'+(i+1)+'</span><span class="step-title">'+esc(s.title)+'</span></button><div class="step-meta"><span><span class="domain-chip" style="background:'+colors[s.domain]+'"></span>'+esc(domain(s.domain).title)+'</span><span>· '+esc(s.actor)+'</span></div><div class="flow-ops">';
    actions.forEach(a=> {
      const tables=[...new Set(s.operations.filter(o=>o.action===a).map(o=>o.table))];
      html+='<div class="flow-op-row"><span class="operation-label '+opClass(a)+'">'+a.toUpperCase()+'</span><span>'+tables.map(flowTableLink).join(' · ')+'</span></div>';
    });
    html+='</div><p class="flow-result">'+esc(s.result)+'</p>';
    if(s.branches.length)html+='<details class="flow-branches"><summary>'+s.branches.length+(s.branches.length>1?' decisões e desvios':' decisão ou desvio')+'</summary>'+s.branches.map(branchHTML).join('')+'</details>';
    html+='</article></li>';
  });
  html+='</ol>';
  $('stage').innerHTML=html;
  $('stage').querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>selectStep(b.dataset.step,true));
  $('stage').querySelectorAll('[data-flow-table]').forEach(b=>b.onclick=()=> {
    currentStep=b.closest('[data-flow-item]').dataset.flowItem;
    markStep();
    openFlowTable(b.dataset.flowTable);
  });
  bindFlowActions($('stage'));
  selectStep(currentStep);
}
function markStep() {
  $('stage').querySelectorAll('[data-flow-item]').forEach(n=> {
    if(n.dataset.flowItem===currentStep)n.setAttribute('aria-current','step');
    else n.removeAttribute('aria-current');
  });
  $('stage').querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.step===currentStep));
}
function selectStep(id,fromClick=false) {
  currentStep=id;
  markStep();
  const j=journeyById(currentJourney),s=flowStep(),i=j.steps.indexOf(s);
  let html='<div class="flow-status">ETAPA '+(i+1)+' DE '+j.steps.length+' · FLUXO PREVISTO</div><div class="domain">'+esc(domain(s.domain).title)+'</div><h2>'+esc(s.title)+'</h2><p class="desc">'+esc(s.actor)+'</p><p class="desc">'+esc(s.result)+'</p><h3>Tabelas e campos utilizados</h3>';
  s.operations.forEach(o=> {
    html+='<div class="flow-detail-op"><span class="operation-label '+opClass(o.action)+'">'+o.action.toUpperCase()+'</span> '+flowTableLink(o.table)+'<p>'+esc(o.why)+'</p><code>'+esc(o.fields.join(', '))+'</code></div>';
  });
  html+='<h3>O que sustenta a etapa</h3>'+s.rules.map(r=>'<div class="flow-rule">'+esc(r)+'</div>').join('')+'<h3>Responsabilidade das rotinas / backend</h3><p class="desc">'+esc(s.routine)+'</p>';
  if(s.transaction)html+='<div class="flow-transaction"><b>Consistência da operação</b><p>'+esc(s.transaction)+'</p></div>';
  if(s.branches.length)html+='<h3>Decisões e desvios</h3>'+s.branches.map(branchHTML).join('');
  html+='<p class="constraint">'+esc(j.references)+'</p><div class="flow-detail-nav">';
  if(i>0)html+='<button type="button" class="tool" data-go-step="'+j.steps[i-1].id+'">Etapa anterior</button>';
  if(i<j.steps.length-1)html+='<button type="button" class="tool" data-go-step="'+j.steps[i+1].id+'">Próxima etapa</button>';
  html+='</div>';
  $('inspector').innerHTML=html;
  $('inspector').scrollTop=0;
  $('inspector').querySelectorAll('[data-flow-table]').forEach(b=>b.onclick=()=>openFlowTable(b.dataset.flowTable));
  bindFlowActions($('inspector'));
  $('selection').textContent='Etapa '+(i+1)+' · '+s.title+' · '+[...new Set(s.operations.map(o=>o.table))].length+' tabelas. Os detalhes não executam alterações no banco.';
  if(fromClick&&window.innerWidth<=1100)$('inspector').scrollIntoView( {
    block:'start'
  });
}
function bindFlowActions(root) {
  root.querySelectorAll('[data-go-journey]').forEach(b=>b.onclick=()=>showJourney(b.dataset.goJourney));
  root.querySelectorAll('[data-go-step]').forEach(b=>b.onclick=()=> {
    selectStep(b.dataset.goStep);
    $('stage').querySelector('[data-flow-item="'+b.dataset.goStep+'"]').scrollIntoView( {
      block:'nearest'
    });
  });
}
function openFlowTable(name) {
  selected=name;
  detailTab='fields';
  inspect();
  $('inspector').scrollTop=0;
  if(window.innerWidth<=1100)$('inspector').scrollIntoView( {
    block:'start'
  });
}
function decorateInspector() {
  const inspector=$('inspector');
  if(uiMode==='journeys') {
    const back=document.createElement('button');
    back.type='button';
    back.className='tool back-step';
    back.textContent='← Voltar à etapa';
    back.dataset.backStep='';
    back.onclick=()=>selectStep(currentStep);
    inspector.prepend(back);
    const modelButton=document.createElement('button');
    modelButton.type='button';
    modelButton.className='tool';
    modelButton.textContent='Ver tabela no diagrama';
    modelButton.dataset.openModel=selected;
    modelButton.onclick=()=>nodeSelect(selected,true);
    inspector.append(modelButton);
  }
  const entries=JOURNEYS.map(j=>( {
    j,steps:j.steps.filter(s=>s.operations.some(o=>o.table===selected))
  })).filter(e=>e.steps.length);
  const box=document.createElement('div');
  box.className='related-journeys';
  box.innerHTML='<h3>Participa destas jornadas</h3>'+(entries.length?entries.map(( {
    j,steps
  })=>'<button type="button" class="table-link" data-related-journey="'+j.id+'" data-related-step="'+steps[0].id+'">'+esc(j.title)+' · '+steps.length+' etapa'+(steps.length>1?'s':'')+'</button>').join(''):'<p class="empty">Tabela ainda não utilizada nas quatro jornadas deste recorte. Sua ficha estrutural continua disponível.</p>');
  inspector.append(box);
  box.querySelectorAll('[data-related-journey]').forEach(b=>b.onclick=()=>showJourney(b.dataset.relatedJourney,b.dataset.relatedStep));
}
// Inicialização da documentação e apresentação das fontes.
$('excluded').innerHTML=MODEL.excluded.map(e=>'<div>'+esc(e.name)+'</div>').join('');
$('exclusion-title').textContent='Escopo: 60 tabelas analisadas · 28 incluídas · 32 excluídas';
$('provenance').textContent='Estrutura: 01_structure.sql · '+F.length+' FKs · SHA-256: '+MODEL.source.sha256+' · Jornadas: regras aprovadas (revisão 2), scripts 01 e 02. Nenhum SQL foi alterado.';
nav();
initJourneys();
show('overview');
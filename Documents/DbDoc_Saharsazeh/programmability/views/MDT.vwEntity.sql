
-------------------------------------
CREATE    VIEW MDT.vwEntity
AS 
SELECT de.ID                               DmdEntityID,
       de.Name                             DmdEntityName,
       dt.Name +'ID' IDColumn,
       CASE de.Name
            WHEN 'PosInvoice' THEN '[POS].[PosInvoiceView]'
            WHEN 'ReturnPosInvoice' THEN '[POS].[PosReturnInvoice]'
            WHEN 'ConfirmStatement' THEN '[CNT].[vwConfirmStatement_RevenueType]'
            ELSE QUOTENAME(dt.[Schema]) + '.' + QUOTENAME(dt.Name)
       END                                 TableName,
       JSON_QUERY(de.Attributes,'$.FlowParams') FlowParams
FROM   mdt.DmdEntity                    AS de
       JOIN mdt.DmdEntityTableRelation  AS detr
            ON  de.ID = detr.DmdEntityID
            AND detr.RelationType = 1
       JOIN mdt.DmdTable                AS dt
            ON  detr.DmdTableID = dt.ID 

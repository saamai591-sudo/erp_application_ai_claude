
-----------------------------------------------
CREATE   view stc.vwStockDocumentTypeBaseEntity
as
SELECT CAST(sdt.Code as NVARCHAR(MAX)) + '-' + CAST(sdtb.Code as NVARCHAR(MAX)) FullCode,
	   sdtb.StockDocumentTypeBaseEntityID,
	   sdt.Title,
	   sdt.Title2,
	   sdt.StockDocumentTypeID,
	   sdtb.BaseEntity,
	   sdt.Type
FROM   stc.StockDocumentTypeBaseEntity sdtb
	   JOIN stc.StockDocumentType sdt
			ON  sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID;


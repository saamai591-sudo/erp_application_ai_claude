CREATE     VIEW [STC].[vwStockDocumentType]
AS 

	SELECT	sdt.StockDocumentTypeID,
			sdt.[Type],
			sdt.Title, 
			sdt.Title2, 
			sdt.DocumentType,
			sdt.DlTypeID, 
			sdt.SlBaseOnDl, 
			sdt.IsActive, 
			CAST(sdt.[Type] AS NVARCHAR(10)) + '-'+CAST(sdt.Code AS NVARCHAR(50)) UniqueCode
	  from stc.StockDocumentType AS sdt


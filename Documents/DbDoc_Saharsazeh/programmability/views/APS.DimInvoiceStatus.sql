
CREATE VIEW [APS].[DimInvoiceStatus]
AS 
	
	SELECT cast(1 AS  TINYINT)AS  Id, N'ثبت' AS Title
	UNION
	SELECT  cast(2 AS  TINYINT)AS  Id , N'ابطال' AS Title
	UNION
	SELECT  cast(3 AS  TINYINT)AS  Id , N'تایید' AS Title
	


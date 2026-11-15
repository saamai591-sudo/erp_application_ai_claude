CREATE   PROC [CFG].[getFileAttachmentType]
(@engName VARCHAR(256))
AS
BEGIN
    DECLARE @ID INT;

    SELECT @ID = de.ID
    FROM MDT.DmdEntity AS de
    WHERE de.[Name] = @engName;

    SELECT a.FileAttachmentTypeID,
			a.Title	AS Title
    FROM CFG.FileAttachmentType a 
    INNER JOIN CFG.vwFileAttachmentTypeAccess b
        ON a.FileAttachmentTypeID = b.FileAttachmentTypeID
    WHERE (a.MetaDataEntityID > 0 AND a.MetaDataEntityID = @ID AND a.IsSystem = 0)
    OR (a.MetaDataEntityID = 0 AND a.IsSystem = 1)
END;


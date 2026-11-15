CREATE     PROC [ACC].[SpDocumentTypeUpdate]
    @DocumentTypeID SMALLINT,
    @Title NVARCHAR(256),
    @Title2 VARCHAR(256),
    @DefaultSelectInReport BIT,
    @isActive BIT = 1,
	@IsSystem BIT ,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @engname VARCHAR(50)
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

IF @Version <>
(
    SELECT [Version]
    FROM [ACC].[DocumentType]
    WHERE [DocumentTypeID] = @DocumentTypeID
)
BEGIN
    RAISERROR('Version mismatch...', 16, 10);
    RETURN;
END;

DECLARE @Message NVARCHAR(MAX);

IF EXISTS
(
    SELECT *
    FROM ACC.DocumentType
    WHERE Title = @Title
          AND [DocumentTypeID] <> @DocumentTypeID
)
BEGIN

    RAISERROR('Title_Duplicated', 16, 12);
    RETURN;
END;

IF EXISTS
(
    SELECT *
    FROM ACC.DocumentType
    WHERE Title2 = @Title2
          AND [DocumentTypeID] <> @DocumentTypeID
)
BEGIN


    RAISERROR('Title2_Duplicated', 16, 12);
    RETURN;
END;

SET @Version = @Version + 1;

UPDATE [ACC].[DocumentType]
SET [Title] = @Title,
    [Title2] = @Title2,
    DefaultSelectInReport = @DefaultSelectInReport,
    IsActive = @isActive,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate,
    [Version] = @Version,
    [engname] = @engname
WHERE [DocumentTypeID] = @DocumentTypeID;

-- Begin Return Select <- do not remove
SELECT  @Version
-- End Return Select <- do not remove

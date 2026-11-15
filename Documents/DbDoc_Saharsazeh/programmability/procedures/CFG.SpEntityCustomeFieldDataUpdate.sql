CREATE     PROC [CFG].[SpEntityCustomeFieldDataUpdate]
    @EntityCustomeFieldDataID INT,
    @EntityCustomeFieldID INT,
    @EntityID DECIMAL(18, 0),
    @Value NVARCHAR(MAX) = NULL,
    @LookupDataItemID  INT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

    IF @Version <> (
           SELECT [Version]
           FROM   [CFG].[EntityCustomeFieldData]
           WHERE  [EntityCustomeFieldDataID] = @EntityCustomeFieldDataID
       )
        RAISERROR('Version mismatch...', 16, 10)


    UPDATE [CFG].[EntityCustomeFieldData]
    SET    [EntityCustomeFieldID] = @EntityCustomeFieldID,
           [EntityID] = @EntityID,
           [Value] = @Value,
           LookupDataItemID = @LookupDataItemID,
           [Version] = @Version + 1,
           [LastEditor] = @LastEditor,
           [LastEditionDate] = @LastEditionDate
    WHERE  [EntityCustomeFieldDataID] = @EntityCustomeFieldDataID
	
    if object_id('RUL.UserDefiendBusinessRules_EntityCustomeFieldData') is not null 
    exec RUL.UserDefiendBusinessRules_EntityCustomeFieldData @EntityCustomeFieldDataID

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM   [CFG].[EntityCustomeFieldData]
    WHERE  [EntityCustomeFieldDataID] = @EntityCustomeFieldDataID 
    -- End Return Select <- do not remove

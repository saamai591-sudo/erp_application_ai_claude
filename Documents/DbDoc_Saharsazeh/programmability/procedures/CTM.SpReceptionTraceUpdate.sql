CREATE   PROC [CTM].[SpReceptionTraceUpdate] 
    @ReceptionTraceID int,
    @ReceptionID int,
    @Number int,
    @Date date,
    @PartyID bigint,
    @ReceptionStatusID int,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
BEGIN
    SET NOCOUNT ON 

    IF (@Number is null) or @Number = 0
        set @Number = isnull((select MAX(Number) from [CTM].[ReceptionTrace]),0) + 1

    set @Version = @Version +1 

    UPDATE [CTM].[ReceptionTrace]
    SET    [ReceptionID] = @ReceptionID, [Number] = @Number, [Date] = @Date, [PartyID] = @PartyID, [ReceptionStatusID] = @ReceptionStatusID, [Description] = @Description, [Description2] = @Description2, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
    WHERE  [ReceptionTraceID] = @ReceptionTraceID
	
    -- Begin Return Select <- do not remove
    SELECT  [Version], Number
    FROM   [CTM].[ReceptionTrace]
    WHERE  [ReceptionTraceID] = @ReceptionTraceID	
    -- End Return Select <- do not remove
END

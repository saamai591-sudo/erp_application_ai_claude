CREATE     PROC [CTM].[spSubscribeCardInsert] 
    @PartyID BIGINT,
    @Number NVARCHAR(50),
    @Password VARCHAR(512),
    @IssueDate DATE,
    @ExpireDate DATE,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS 
    SET NOCOUNT ON 

    EXEC ctm.CheckSubscribeCard
	    @Id = null,
	    @Number = @number,
	    @Issuedate = @Issuedate,
	    @ExpireDate = @ExpireDate,
	    @PartyId = @PartyId
	
    INSERT INTO [CTM].[SubscribeCard]
      (
        [PartyID],
        [Number],
        [Password],
        [IssueDate],
        [ExpireDate],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
      )
    SELECT @PartyID,
           @Number,
           @Password,
           @IssueDate,
           @ExpireDate,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate,
           0
	
    -- Begin Return Select <- do not remove
    SELECT [SubscribeCardID],
           [Version]
    FROM   [CTM].[SubscribeCard]
    WHERE  [SubscribeCardID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove

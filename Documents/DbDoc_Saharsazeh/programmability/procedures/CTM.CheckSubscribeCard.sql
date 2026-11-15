/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.1.261
 * Time: 7/11/2017 12:46:26 PM
 ************************************************************/

CREATE PROCEDURE [CTM].[CheckSubscribeCard](
    @Id             INT,
    @Number         NVARCHAR(50),
    @Issuedate      DATE,
    @ExpireDate     DATE,
    @PartyId        INT
)
AS
	IF @ExpireDate IS NULL
	    SET @ExpireDate = '9999-12-31'
	
	IF EXISTS(
	       SELECT 1
	       FROM   CTm.SubscribeCard AS sc
	       WHERE  (@Id IS NULL OR sc.SubscribeCardID <> @Id)
	              AND @PartyId = PartyID
	              AND (
	                      sc.IssueDate BETWEEN @Issuedate AND @ExpireDate
	                      OR ISNULL(sc.[ExpireDate], '9999-12-31') BETWEEN @Issuedate AND @ExpireDate
	                  )
	   )
	BEGIN
	    RAISERROR(
	        'با توجه به تاریخ های انتخاب شده، طرف حساب دارای کارت فعال می باشد.',
	        16,
	        12
	    )
	    RETURN;
	END
	
	IF EXISTS(
	       SELECT 1
	       FROM   CTm.SubscribeCard AS sc
	       WHERE  (@Id IS NULL OR sc.SubscribeCardID <> @Id)
	              AND @Number = Number
	              AND (
	                      sc.IssueDate BETWEEN @Issuedate AND @ExpireDate
	                      OR ISNULL(sc.[ExpireDate], '9999-12-31') BETWEEN @Issuedate AND @ExpireDate
	                  )
	   )
	BEGIN
	    RAISERROR(
	        'با توجه به تاریخ های انتخاب شده، این شماره فعال می باشد.',
	        16,
	        12
	    )
	    RETURN;
	END

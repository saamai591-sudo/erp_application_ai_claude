/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 12/5/2017 3:05:46 PM
 ************************************************************/

CREATE PROCEDURE [CFG].[ApplyFixVersion](
    @version        VARCHAR(100),
    @Fix            VARCHAR(50),
    @NewVersion     VARCHAR(50)
)
AS
	INSERT INTO cfg.VersionFix
	  (
	    [Version],
	    Fix,
	    ApplyDate
	  )
	VALUES
	  (
	    @version,
	    @Fix,
	    GETDATE()
	  )
	
	UPDATE cfg.VersionInfo
	SET	   SystemVersion       = @NewVersion,
	       DbVersion         = @NewVersion
	WHERE  VersionInfoID     = (
	           SELECT MAX(VersionInfoID)
	           FROM   cfg.VersionInfo
	       )

